// Shared ride command surface — the single, UI-free path for starting and ending
// a ride. Both the phone screens (start-ride, ride-hud) and the CarPlay
// coordinator call these so a ride started or ended from the head unit goes
// through exactly the same orchestration (permissions, ride id, MMKV, GPS/
// background-location listener, server sync, analytics) as one started on the
// phone. Navigation and other UI concerns stay with the callers — these return
// data, they don't route.

import {
  EndRideDocument,
  MyMotorcyclesDocument,
  type MyMotorcyclesQuery,
  StartRideDocument,
} from '@motovault/graphql';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { AnalyticsEvent, captureException, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { invalidateSavedRide } from '../../lib/invalidate';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/query-keys';
import { RIDE_SAVE_TRIGGER, trackRideCompleted } from '../../lib/ride-analytics';
import { useRideStore } from '../../stores/ride.store';
import { selectPrimaryBike } from '../../utils/primary-bike';
import { aggregateWaypoints } from '../../utils/ride-aggregate';
import { activeRideSeconds, movingTimeSeconds } from '../../utils/ride-duration';
import { encodePolyline } from '../../utils/ride-heatmap';
import {
  endAutoPauseEpisode,
  isLocationRecording,
  startGPSListener,
  stopGPSListener,
} from '../../utils/ride-location';
import {
  checkAndRequestPermissions,
  isApproximateLocation,
  type PermissionLevel,
  readPermissionLevel,
} from '../../utils/ride-permissions';
import {
  armRideReminders,
  cancelRideReminders,
  rideEndTrimTarget,
} from '../../utils/ride-reminders';
import {
  clearCurrentRide,
  clearRideData,
  flushBufferToMMKV,
  getPointBuffer,
  getWaypointChunks,
  RIDE_PHASE,
  readRideRecord,
  removeWaypointBuffer,
  resetWaypointBudget,
  restoreBufferFromMMKV,
  rideMMKV,
} from '../../utils/ride-storage';
import { enqueueOrExecute, enqueueWaypointUpload } from '../../utils/ride-sync-queue';

export type RideSource = 'phone' | 'carplay';

export type RideStartFailureReason = 'denied' | 'gps_failed' | 'approximate';

export type RideStartResult =
  | { ok: true; rideId: string }
  | { ok: false; reason: RideStartFailureReason };

// Which surface may prompt for location. The phone shows the disclosure modal first
// and owns every request; CarPlay only reads, so a head-unit Start never raises an
// iPhone alert (or the "Change to Always Allow?" upgrade) the rider can't answer.
const RESOLVE_PERMISSION_LEVEL: Record<RideSource, () => Promise<PermissionLevel>> = {
  phone: checkAndRequestPermissions,
  carplay: readPermissionLevel,
};

export interface StartRideOptions {
  motorcycleId: string | null;
  source: RideSource;
  /** Optional, analytics only. */
  motorcycleMake?: string | null;
  /** Start even though the OS only grants approximate location (rider chose to). */
  allowApproximate?: boolean;
}

/**
 * Ask for notification permission at the moment it is obviously useful — the rider
 * is starting a ride and the "still riding?" reminders depend on it. Onboarding was
 * the only other place it was asked, so anyone who skipped it never got a reminder
 * (and on Android 13+ never saw the recording notification either). Never re-asks a
 * rider who already said no; never blocks the start.
 */
async function ensureNotificationPermission(): Promise<void> {
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined' && canAskAgain) await Notifications.requestPermissionsAsync();
  } catch (err) {
    captureException(err, { source: 'ride-controller.ensureNotificationPermission' });
  }
}

/**
 * The bike a ride with no explicitly chosen motorcycle should attribute to: the
 * primary (or first) bike. CarPlay has no head-unit picker and the phone "Quick Ride"
 * skips selection, but the rider still expects the odometer to track — and the API
 * only applies ride mileage when the ride carries a motorcycle_id. Cache-first; fetches
 * once if the list isn't cached yet (cold CarPlay launch). Returns null when the rider
 * genuinely has no bikes / is offline, leaving the ride bike-less (no odometer update).
 */
async function resolvePrimaryMotorcycleId(): Promise<string | null> {
  let cache = queryClient.getQueryData<MyMotorcyclesQuery>(queryKeys.motorcycles.all);
  if (!cache) {
    try {
      cache = await gqlFetcher(MyMotorcyclesDocument);
    } catch {
      return null;
    }
  }
  const bikes = cache?.myMotorcycles ?? [];
  return selectPrimaryBike(bikes)?.id ?? null;
}

/**
 * Start a fresh ride: resolve location permission for the calling surface (the phone
 * may prompt, CarPlay only reads — see RESOLVE_PERMISSION_LEVEL), mint the ride id, persist it, flip the
 * store to recording, enqueue the server start, and begin the background-capable
 * GPS listener. Returns the new ride id, or `{ ok: false, reason: 'denied' }` when
 * location permission is refused (the caller surfaces the UI).
 */
// The start in progress, if any. A start awaits permission (on the phone that can
// be an OS dialog open for seconds), location quality and the primary bike before
// it mints the ride, so a second Start from the other surface in that window must
// join this one instead of minting a second ride over it.
let startInFlight: Promise<RideStartResult> | null = null;

export function startRideSession(options: StartRideOptions): Promise<RideStartResult> {
  if (!startInFlight) {
    startInFlight = runStartRideSession(options).finally(() => {
      startInFlight = null;
    });
  }
  return startInFlight;
}

async function runStartRideSession({
  motorcycleId,
  source,
  motorcycleMake = null,
  allowApproximate = false,
}: StartRideOptions): Promise<RideStartResult> {
  // One ride at a time. A ride still recording or paused is the one Start should
  // lead to (a second id would orphan its points; the server would close it as
  // stale). A ride that ended but was never reviewed is saved as it stands — it
  // is already complete on the server — so a new ride never waits on the phone
  // (CarPlay must not need the iPhone to start).
  const existing = readRideRecord();
  if (existing && existing.phase !== RIDE_PHASE.ENDED) {
    // Leading to it means it must actually be recording: after an app kill the
    // GPS task may not be running.
    if (!(await isLocationRecording()) && !(await resumeRecoveredRide())) {
      return { ok: false, reason: 'gps_failed' };
    }
    useRideStore.setState({ recordingInterrupted: false });
    return { ok: true, rideId: existing.rideId };
  }
  if (existing) saveEndedRideAsItStands(existing.rideId);

  const level = await RESOLVE_PERMISSION_LEVEL[source]();
  if (level === 'denied') return { ok: false, reason: 'denied' };

  // Approximate location fixes are ~1-3 km wide; the GPS filter rejects anything
  // over 50 m, so such a ride records 0 waypoints and 0 m — and then the rider is
  // told it was "too short". Say so up front instead. CarPlay can't show the
  // choice, so it records anyway (same as before).
  if (source === 'phone' && !allowApproximate && (await isApproximateLocation())) {
    return { ok: false, reason: 'approximate' };
  }
  if (source === 'phone') await ensureNotificationPermission();

  // No bike explicitly chosen (CarPlay has no picker; phone "Quick Ride") → attribute
  // to the primary bike so the odometer still tracks on ride-end (the API applies
  // mileage only when the ride carries a motorcycle_id).
  const effectiveMotorcycleId = motorcycleId ?? (await resolvePrimaryMotorcycleId());

  const rideId = Crypto.randomUUID();
  const startedAt = new Date().toISOString();

  rideMMKV.setCurrentId(rideId);
  rideMMKV.setStatus(RIDE_PHASE.RECORDING);
  rideMMKV.setStartedAt(Date.now());
  // Start the pause clock clean — a prior ride's banked/in-progress pause must not
  // leak into this one's elapsed/duration math.
  rideMMKV.setTotalPausedMs(0);
  rideMMKV.setPausedAt(0);
  // Same reasoning for the waypoint budget: a previous ride's banked count would
  // start this one part-way through its cap and decimate a short ride for no reason.
  resetWaypointBudget();
  if (effectiveMotorcycleId) rideMMKV.setMotorcycleId(effectiveMotorcycleId);

  const store = useRideStore.getState();
  store.setPermissionLevel(level);
  store.startRide();

  try {
    await startGPSListener();
  } catch (err) {
    // GPS failed to start — roll back so we never strand a half-started ride
    // (persisted id + recording store) that the next launch reads as unfinished.
    captureException(err, { source: 'ride-controller.startRideSession' });
    clearCurrentRide();
    store.hydrate();
    void cancelRideReminders();
    return { ok: false, reason: 'gps_failed' };
  }

  // Start the forgotten-ride clock: if the bike never moves, the rider still hears.
  void armRideReminders();

  // Haptic confirms the start on the phone; on CarPlay the phone may be pocketed.
  if (source === 'phone' && process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  // Tell the server only after GPS is confirmed running (rollback above otherwise).
  enqueueOrExecute('startRide', {
    mutationDocument: StartRideDocument,
    variables: { input: { rideId, motorcycleId: effectiveMotorcycleId, startedAt } },
  });

  trackEvent(AnalyticsEvent.RIDE_STARTED, {
    ride_id: rideId,
    has_motorcycle: !!effectiveMotorcycleId,
    motorcycle_id: effectiveMotorcycleId ?? null,
    motorcycle_make: motorcycleMake,
    hud_layout: rideMMKV.getHudLayout() ?? 'A',
    is_resumed: false,
    source,
  });

  return { ok: true, rideId };
}

export interface RideEndSummary {
  rideId: string;
  distanceM: number;
  durationS: number;
  maxSpeedMps: number;
  avgSpeedMps: number;
  elevationGain: number;
  elevationLoss: number;
  startedAt: number | undefined;
  motorcycleId: string | null;
  /**
   * Moving time by the server's formula (`movingTimeSeconds`): floored elapsed
   * seconds minus the rounded manual AND auto pauses sent with EndRide. `durationS`
   * is the displayed clock (rounded, manual pauses only); the ride-moment paywall
   * rule (plan R1) must use this one so the phone agrees with the server's count.
   */
  movingTimeS: number;
}

/** Elapsed riding seconds derived from persisted timestamps (no UI timer needed). */
export function elapsedRideSeconds(now: number = Date.now()): number {
  // Subtract banked pauses plus any pause currently in progress, so the clock
  // freezes while paused — from either surface — without a live UI timer running.
  return activeRideSeconds(
    {
      startedAt: rideMMKV.getStartedAt(),
      totalPausedMs: rideMMKV.getTotalPausedMs(),
      pausedAt: rideMMKV.getPausedAt(),
    },
    now,
  );
}

/**
 * Pause the recording ride — from the HUD or the head unit, identically: persist
 * the phase and the pause start (the clock freezes on it), project, and swap the
 * "still riding?" reminders for the single "still paused" one. False when there
 * is no recording ride to pause (a double press, or a ride already ended).
 */
export function pauseRideSession(source: RideSource): boolean {
  const record = readRideRecord();
  if (record?.phase !== RIDE_PHASE.RECORDING) return false;
  const now = Date.now();
  // A stop the GPS was timing ends here: the pause is the rider's, not the GPS's.
  endAutoPauseEpisode(now);
  rideMMKV.setStatus(RIDE_PHASE.PAUSED);
  rideMMKV.setPausedAt(now);
  useRideStore.setState({ status: 'paused', currentSpeed: 0 });
  void armRideReminders(now);
  trackEvent(AnalyticsEvent.RIDE_PAUSED, {
    ride_id: record.rideId,
    duration_at_pause_s: elapsedRideSeconds(now),
    distance_at_pause_m: Math.round(useRideStore.getState().distance),
    source,
  });
  return true;
}

/**
 * Resume a paused ride: bank the pause into the persisted total, persist the
 * phase, project, and restart the "still riding?" clock from now. False when the
 * ride is not paused.
 */
export function resumeRideSession(source: RideSource): boolean {
  const record = readRideRecord();
  if (record?.phase !== RIDE_PHASE.PAUSED) return false;
  const now = Date.now();
  const pausedAt = rideMMKV.getPausedAt();
  const pausedMs = pausedAt > 0 ? Math.max(0, now - pausedAt) : 0;
  rideMMKV.setTotalPausedMs(rideMMKV.getTotalPausedMs() + pausedMs);
  rideMMKV.setPausedAt(0);
  rideMMKV.setStatus(RIDE_PHASE.RECORDING);
  useRideStore.setState({ status: 'recording' });
  void armRideReminders(now);
  trackEvent(AnalyticsEvent.RIDE_RESUMED, {
    ride_id: record.rideId,
    pause_duration_s: Math.round(pausedMs / 1000),
    source,
  });
  return true;
}

export interface EndRideOptions {
  /**
   * Epoch ms the ride really ended — the last movement, when ended from a
   * "still riding?" reminder. Defaults to now. Duration and `endedAt` both use it,
   * so a ride forgotten for an hour does not report an hour of standing still.
   */
  endAt?: number;
}

/**
 * End the current ride: aggregate the recorded waypoints, stop the GPS listener,
 * flip the store to ended, fire analytics, and enqueue the server end. Returns a
 * summary for the caller to render/navigate with, or null when no ride is active.
 * Pure of navigation so it can run from CarPlay with no phone UI mounted.
 */
export function endRideSession(
  source: RideSource = 'phone',
  { endAt }: EndRideOptions = {},
): RideEndSummary | null {
  const rideId = rideMMKV.getCurrentId();
  if (!rideId) return null;

  // Idempotent against a double-Stop (or a Stop racing the auto-end timer): this
  // function deliberately does NOT clear the persisted ride id (the summary owns
  // cleanup), so without this guard a second invocation would re-run the full end
  // path and enqueue a duplicate EndRide mutation + a second summary navigation.
  // Once the ride is ended — persisted, so this holds across an app kill too — bail.
  if (readRideRecord()?.phase === RIDE_PHASE.ENDED) return null;
  if (useRideStore.getState().status === 'ended') return null;

  // After an app kill (ending from a reminder, or from the unfinished-ride banner)
  // the in-memory buffer is empty and the partial chunk only exists on disk —
  // load it, or those points silently drop out of the distance and route.
  if (getPointBuffer().length === 0) restoreBufferFromMMKV(rideId);
  flushBufferToMMKV(rideId);

  const chunks = getWaypointChunks(rideId);
  const bufferPoints = [...getPointBuffer()];
  const combined = [...chunks.flat(), ...bufferPoints];

  void enqueueWaypointUpload(rideId, bufferPoints);
  // Drop the persisted buffer key now that the points are durably enqueued —
  // prevents crash-recovery from re-enqueuing them as duplicates after end.
  removeWaypointBuffer(rideId);

  const totals = aggregateWaypoints(combined);
  const totalDistance = totals.distanceM;
  const maxSpd = totals.maxSpeedMps;
  const avgSpeed = totals.avgSpeedMps;
  const elevGain = totals.elevationGain;
  const elevLoss = totals.elevationLoss;
  // If the ride is ended while still paused, bank the in-progress pause first so
  // both the derived duration and pausedDurationS account for it.
  // A trimmed end banks only the part of the pause before the end point.
  const endedAtMs = endAt ?? Date.now();
  const pausedAtEnd = rideMMKV.getPausedAt();
  if (pausedAtEnd > 0) {
    const bankedMs = Math.max(0, endedAtMs - pausedAtEnd);
    rideMMKV.setTotalPausedMs(rideMMKV.getTotalPausedMs() + bankedMs);
    rideMMKV.setPausedAt(0);
  }
  // Same for a stop the GPS was still timing: bank it as auto-paused, up to the end.
  endAutoPauseEpisode(endedAtMs);
  const durationS = elapsedRideSeconds(endedAtMs);
  const totalPausedMs = rideMMKV.getTotalPausedMs();
  const totalAutoPausedMs = rideMMKV.getTotalAutoPausedMs();
  // Capture identity before store.endRide() — the ride-summary screen owns MMKV
  // cleanup (on save/discard), and the returned summary must still carry these.
  const startedAt = rideMMKV.getStartedAt();
  const motorcycleId = rideMMKV.getMotorcycleId() ?? null;
  const store = useRideStore.getState();
  const maxLeanAngle = store.maxLeanAngle;
  const isNightMode = store.isNightMode;
  const isBatterySaver = store.isBatterySaver;
  const endedAt = new Date(endedAtMs).toISOString();

  const summary: RideEndSummary = {
    rideId,
    distanceM: Math.round(totalDistance),
    durationS,
    maxSpeedMps: maxSpd,
    avgSpeedMps: avgSpeed,
    elevationGain: Math.round(elevGain),
    elevationLoss: Math.round(elevLoss),
    startedAt,
    motorcycleId,
    movingTimeS: startedAt
      ? movingTimeSeconds(startedAt, endedAtMs, totalPausedMs, totalAutoPausedMs)
      : 0,
  };
  // Kept with the ride so its review can reopen after an app kill, or when the
  // summary never opened (CarPlay Stop with no phone UI to navigate). Written
  // before the phase flips: a surface that renders on the flip (the CarPlay
  // panel's store subscription runs synchronously) must already find it.
  rideMMKV.setEndedSummaryJson(JSON.stringify(summary));

  // Persist the end before anything else can observe it: the GPS task drops
  // samples for an ended ride, and a relaunch now sees "ended — review", never
  // a resumable ride the server has already completed.
  rideMMKV.setStatus(RIDE_PHASE.ENDED);
  store.endRide();
  void stopGPSListener();

  trackEvent(AnalyticsEvent.RIDE_ENDED, {
    ride_id: rideId,
    motorcycle_id: motorcycleId,
    duration_s: durationS,
    distance_m: Math.round(totalDistance),
    pause_count: totalPausedMs > 0 ? 1 : 0,
    total_pause_duration_s: Math.round(totalPausedMs / 1000),
    night_mode_used: isNightMode,
    battery_saver_used: isBatterySaver,
    hud_layout_final: rideMMKV.getHudLayout() ?? 'A',
    max_speed_kmh: Math.round(maxSpd * 3.6),
    avg_speed_kmh: Math.round(avgSpeed * 3.6),
    waypoint_count: combined.length,
    source,
    trimmed_s: Math.max(0, Math.round((Date.now() - endedAtMs) / 1000)),
  });

  const polyline =
    combined.length >= 2
      ? encodePolyline(combined.map((wp) => [wp.latitude, wp.longitude] as [number, number]))
      : null;

  enqueueOrExecute('endRide', {
    mutationDocument: EndRideDocument,
    variables: {
      input: {
        rideId,
        endedAt,
        distanceM: Math.round(totalDistance),
        maxSpeedMps: maxSpd > 0 ? maxSpd : null,
        avgSpeedMps: avgSpeed > 0 ? avgSpeed : null,
        elevationGain: elevGain > 0 ? Math.round(elevGain) : null,
        elevationLoss: elevLoss > 0 ? Math.round(elevLoss) : null,
        routePolyline: polyline,
        pausedDurationS: Math.round(totalPausedMs / 1000),
        autoPausedDurationS: Math.round(totalAutoPausedMs / 1000),
        gpsQuality: combined.length > 0 ? 1 : 0,
        maxLeanAngle: maxLeanAngle > 0 ? maxLeanAngle : null,
      },
    },
  });

  // Both the phone HUD and a CarPlay Stop now route to the ride-summary screen,
  // which is the single owner of ride-data cleanup (it clears on save/discard).
  // We deliberately do NOT clear here — clearing would wipe the waypoint chunks the
  // summary reads to draw the route. (autoEndRide is the only truly headless end; it
  // stops GPS and drops the in-memory buffer but, like this path, leaves the
  // persisted ride id for the summary / crash-recovery to reconcile.)
  return summary;
}

const SUMMARY_NUMBER_FIELDS = [
  'distanceM',
  'durationS',
  'maxSpeedMps',
  'avgSpeedMps',
  'elevationGain',
  'elevationLoss',
  'movingTimeS',
] as const satisfies readonly (keyof RideEndSummary)[];

/** An ended ride's summary as stored for its review. */
export interface StoredRideSummary extends RideEndSummary {
  /** Ended from crash recovery, not by the rider's Stop (see buildRideSummaryHref). */
  recovered?: boolean;
}

/**
 * The summary of the current ride when it has ended but is not yet saved or
 * discarded — what "Review" reopens. Null for any other state, or when the
 * stored summary is unreadable (a review then cannot be rebuilt).
 */
export function readEndedRideSummary(): StoredRideSummary | null {
  const record = readRideRecord();
  if (record?.phase !== RIDE_PHASE.ENDED) return null;
  const json = rideMMKV.getEndedSummaryJson();
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as Partial<StoredRideSummary>;
    if (parsed.rideId !== record.rideId) return null;
    if (!SUMMARY_NUMBER_FIELDS.every((field) => typeof parsed[field] === 'number')) return null;
    return parsed as StoredRideSummary;
  } catch {
    return null;
  }
}

/**
 * Done with an ended ride — saved or discarded on its summary, or auto-saved
 * because a new ride started. Removes it from the phone (only its own data: see
 * clearRideData) and brings every surface back to idle.
 */
export function finalizeEndedRide(rideId: string): boolean {
  // Still the ride waiting for review? Not when a new start already saved it as
  // it stands (CarPlay Stop, then Start, with its summary still open on the
  // phone): that save was counted, so the caller must not count it again.
  const pending = rideMMKV.getCurrentId() === rideId;
  clearRideData(rideId);
  useRideStore.getState().hydrate();
  return pending;
}

/**
 * A new ride is starting over one that ended but was never reviewed: keep it as
 * it stands. It is already complete on the server, so this is the save the
 * summary would have made — counted, and the caches it changed refreshed.
 */
function saveEndedRideAsItStands(rideId: string): void {
  const summary = readEndedRideSummary();
  finalizeEndedRide(rideId);
  invalidateSavedRide(queryClient);
  if (!summary) return;
  trackRideCompleted({
    trigger: RIDE_SAVE_TRIGGER.NEW_RIDE,
    rideId,
    motorcycleId: summary.motorcycleId,
    distanceM: summary.distanceM,
    durationS: summary.durationS,
  });
}

/**
 * Pick up the ride Start Ride found unfinished after the app was killed: stats
 * restored from what was recorded, a paused ride kept paused, GPS running again.
 * False when there is no recording or paused ride to resume (an ended ride is
 * reviewed, never resumed — the server has already completed it).
 */
// The restart in progress, if any: CarPlay Resume, the permission recovery and
// Start Ride's Resume can all ask at once, and must share one restart.
let resumeInFlight: Promise<boolean> | null = null;

export function resumeRecoveredRide(): Promise<boolean> {
  if (!resumeInFlight) {
    resumeInFlight = runResumeRecoveredRide().finally(() => {
      resumeInFlight = null;
    });
  }
  return resumeInFlight;
}

async function runResumeRecoveredRide(): Promise<boolean> {
  const record = readRideRecord();
  if (!record || record.phase === RIDE_PHASE.ENDED) return false;
  // Project first: hydrate seeds the totals from the stored waypoints, including
  // the persisted partial buffer that startGPSListener is about to move into memory.
  useRideStore.getState().hydrate();
  try {
    await startGPSListener();
  } catch (err) {
    captureException(err, { source: 'ride-controller.resumeRecoveredRide' });
    return false;
  }
  // The ride may have been ended (Stop on the head unit, End on the phone) while
  // GPS was starting — that stop can miss a task not yet running. An ended or
  // discarded ride must not go on recording; a ride replaced by a new one owns
  // the GPS now and is left alone.
  const current = readRideRecord();
  if (current?.rideId !== record.rideId || current.phase === RIDE_PHASE.ENDED) {
    if (!current || current.phase === RIDE_PHASE.ENDED) void stopGPSListener();
    return false;
  }
  useRideStore.setState({ recordingInterrupted: false });
  // The phase picks the set: "still riding?" for a recording ride, "still
  // paused" for a paused one.
  void armRideReminders();
  trackEvent(AnalyticsEvent.RIDE_STARTED, {
    ride_id: record.rideId,
    has_motorcycle: !!rideMMKV.getMotorcycleId(),
    motorcycle_id: rideMMKV.getMotorcycleId() ?? null,
    motorcycle_make: null,
    hud_layout: rideMMKV.getHudLayout() ?? 'A',
    is_resumed: true,
  });
  return true;
}

/**
 * The ride-summary route for a finished ride. Shared by the phone HUD's End and the
 * CarPlay Stop so both surfaces land on the same summary (which reads these params
 * and owns clearing the ride data). Pure — builds the Href, never navigates.
 *
 * `recovered`: the ride was ended from the crash-recovery prompt on Start Ride, not
 * by the rider's Stop. The ride-moment teaser then suppresses its evaluation as
 * recovered_unconfirmed instead of trusting a server-side end it cannot confirm.
 */
export function buildRideSummaryHref(
  summary: RideEndSummary,
  { recovered = false }: { recovered?: boolean } = {},
): Href {
  return {
    pathname: '/(modals)/ride-summary',
    params: {
      rideId: summary.rideId,
      distanceM: String(summary.distanceM),
      durationS: String(summary.durationS),
      maxSpeedMps: String(summary.maxSpeedMps),
      avgSpeedMps: String(summary.avgSpeedMps),
      elevationGain: String(summary.elevationGain),
      elevationLoss: String(summary.elevationLoss),
      startedAt: summary.startedAt?.toString() ?? '',
      motorcycleId: summary.motorcycleId ?? '',
      movingTimeS: String(summary.movingTimeS),
      recovered: recovered ? '1' : '',
    },
  };
}

/**
 * End the unfinished ride Start Ride found after an app kill, trimmed to its last
 * movement, and return the summary to open — marked `recovered`, because the phone
 * cannot confirm the server accepted this end. Null when there is no ride to end.
 */
export function endRecoveredRide(source: RideSource = 'phone'): Href | null {
  const summary = endRideSession(source, { endAt: rideEndTrimTarget() });
  if (!summary) return null;
  // Kept with the ride, so a review reopened after another kill is still
  // evaluated as recovered.
  const stored: StoredRideSummary = { ...summary, recovered: true };
  rideMMKV.setEndedSummaryJson(JSON.stringify(stored));
  return buildRideSummaryHref(summary, { recovered: true });
}
