import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18n from '../i18n';
import { AnalyticsEvent, addBreadcrumb, captureException, trackEvent } from '../lib/analytics';
import {
  CORE_LOCATION_ERROR_CODE,
  classifyLocationTaskError,
  LOCATION_TASK_ERROR_ACTION,
  type LocationTaskError,
  type LocationTaskErrorAction,
} from '../lib/location-error';
import { NOTIFICATION_CHANNEL, NOTIFICATION_KIND } from '../lib/notifications';
import { useRideStore } from '../stores/ride.store';
import { haversineMeters } from './geo-utils';
import { gpsFilter } from './ride-gps-filter';
import { encodePolyline } from './ride-heatmap';
import {
  cancelRideReminders,
  noteRideMovement,
  RIDE_IDLE_FINAL_MINUTES,
  RIDE_IDLE_NUDGE_MINUTES,
} from './ride-reminders';
import {
  appendWaypoint,
  clearPointBuffer,
  clearRideData,
  flushBufferToMMKV,
  getPointBuffer,
  getWaypointChunks,
  removeWaypointBuffer,
  restoreBufferFromMMKV,
  rideMMKV,
} from './ride-storage';
import { enqueueOrExecute, enqueueWaypointUpload } from './ride-sync-queue';

// --- Constants ---

export const BACKGROUND_LOCATION_TASK = 'ride-background-location';

// Flag "probably forgot to stop" (CarPlay prompt) at 10 min; auto-end at 30 min.
// The rider-facing notifications are NOT driven from here — they are scheduled by
// ride-reminders off the last movement, because this machine only runs when a GPS
// sample arrives and a parked bike delivers none.
const FORGOT_TO_STOP_NOTIFY_MS = RIDE_IDLE_NUDGE_MINUTES * 60_000;
const FORGOT_TO_STOP_AUTO_END_MS = RIDE_IDLE_FINAL_MINUTES * 60_000;
const AUTO_PAUSE_SPEED_THRESHOLD = 0.5; // m/s
/** Minimum radius a stopped rider must leave before it counts as creeping forward.
 *  A parked phone's fixes wander well past 5 m (indoors, under trees); the old 5 m
 *  radius read that jitter as movement and reset the stop clock on every sample. */
const AUTO_PAUSE_DISTANCE_THRESHOLD = 25; // meters
/** ...and never less than twice the fix's own accuracy radius. */
const AUTO_PAUSE_ACCURACY_FACTOR = 2;
const AUTO_PAUSE_DURATION_MS = 60_000; // 60 seconds
/** Persist the partial waypoint buffer this often, so a kill loses at most this much. */
const BUFFER_FLUSH_INTERVAL_MS = 30_000;

/** Single origin tag for everything this task reports — it is also the Sentry
 *  fingerprint/`capture.source` key, so it must not drift between call sites. */
const LOCATION_TASK_CAPTURE_SOURCE = 'ride-location.backgroundLocationTask';

// --- Auto-pause state (module-level, survives across callbacks) ---

let zeroSpeedTimer: number | null = null;
let zeroSpeedAnchor: { lat: number; lng: number } | null = null;
let continuousAutoPauseStart: number | null = null;
let forgotToStopNotified = false;
/** One capture + one notification per ride, however many denied callbacks fire.
 *  51 Sentry events across 4 riders came from re-reporting the same dead stream. */
let permissionLostReported = false;
let lastBufferFlushAt = 0;
/** The ride whose on-disk partial buffer this process has already loaded. A headless
 *  relaunch (iOS wakes the app for a location update after a kill) never runs
 *  startGPSListener, so without this the first periodic flush would overwrite the
 *  points saved before the kill with a one-point buffer. */
let bufferRestoredForRideId: string | null = null;

// --- Haversine ---

/** Great-circle distance in meters between two `{lat,lng}` points. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return haversineMeters(a, b);
}

// --- GPS Listener ---
//
// Recording runs through `Location.startLocationUpdatesAsync` + the
// BACKGROUND_LOCATION_TASK (defined below), NOT a foreground `watchPositionAsync`
// subscription. This is what keeps a ride recording while the app is backgrounded
// or the screen is locked — e.g. riding with CarPlay up — and lets iOS relaunch
// the app headless to keep tracking after a kill. The task delivers samples in all
// app states; the foreground HUD reads the resulting stats from the store, so no
// separate foreground watcher is needed.

let onLocationCallback: ((location: Location.LocationObject) => void) | null = null;

/** Location-update options; the battery-saver variant trades accuracy for power. */
function locationUpdateOptions(batterySaver: boolean): Location.LocationTaskOptions {
  return {
    accuracy: batterySaver ? Location.Accuracy.Balanced : Location.Accuracy.BestForNavigation,
    distanceInterval: batterySaver ? 15 : 5,
    timeInterval: batterySaver ? 5000 : 1000,
    // Keep recording when the app is backgrounded / screen locked.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    // Android requires a foreground service to keep location updates alive.
    foregroundService: {
      notificationTitle: i18n.t('rideHud.serviceTitle', {
        defaultValue: 'MotoVault is recording your ride',
      }),
      notificationBody: i18n.t('rideHud.serviceBody', {
        defaultValue: 'Tap to return to your ride. End it when you get off the bike.',
      }),
      notificationColor: palette.signature500,
    },
  };
}

export async function startGPSListener(
  onLocation: (location: Location.LocationObject) => void = () => {},
): Promise<void> {
  onLocationCallback = onLocation;
  // Restore any in-memory buffer from MMKV (crash recovery)
  const rideId = rideMMKV.getCurrentId();
  if (rideId) {
    restoreBufferFromMMKV(rideId);
    bufferRestoredForRideId = rideId;
  }

  // Reset GPS filter for fresh ride
  gpsFilter.reset();

  // Idempotent: best-effort drop a still-running session before starting fresh.
  // A throw here must not block the fresh start, so swallow + log.
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    captureException(err, { source: 'ride-location.startGPSListener.cleanup' });
  }

  // Throws propagate to the caller (startRideSession rolls the ride back).
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, locationUpdateOptions(false));
}

export async function stopGPSListener(): Promise<void> {
  // Cancel the forgotten-ride reminders first, synchronously: their ids are taken
  // before any await, so neither a caller that clears all ride data right after
  // (the headless auto-end) nor a rejected stopLocationUpdatesAsync below can
  // leave a "still riding?" reminder scheduled for an ended ride.
  void cancelRideReminders();

  // Flush in-memory buffer to MMKV before stopping
  const rideId = rideMMKV.getCurrentId();
  if (rideId) flushBufferToMMKV(rideId);

  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
  onLocationCallback = null;
  resetAutoPauseState();
}

export async function toggleBatterySaver(enabled: boolean): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    await Location.startLocationUpdatesAsync(
      BACKGROUND_LOCATION_TASK,
      locationUpdateOptions(enabled),
    );
  }
}

// --- Auto-pause decision (pure) ---

export interface AutoPauseState {
  zeroSpeedTimer: number | null;
  zeroSpeedAnchor: { lat: number; lng: number } | null;
  continuousAutoPauseStart: number | null;
  forgotToStopNotified: boolean;
}

/** A side effect the caller should perform after an auto-pause decision. */
export type AutoPauseEffect =
  | { kind: 'setSubState'; value: 'stopped' | 'moving' }
  | { kind: 'updateSpeedZero' }
  | { kind: 'addAutoPausedMs'; ms: number }
  /** Persist/clear the "probably forgot to stop" flag for other surfaces (CarPlay). */
  | { kind: 'setForgotToStopPending'; value: boolean }
  | { kind: 'autoEnd'; idleSince: number };

export interface AutoPauseDecision {
  next: AutoPauseState;
  /** True only when this sample proves real movement: speed above the threshold, or
   *  a creep beyond the jitter radius. A parked phone's wandering fixes are not. */
  moving: boolean;
  /** Ordered side effects for the caller to apply via the effect handlers. */
  effects: AutoPauseEffect[];
  /** When true, the caller should stop processing this location sample. */
  abort: boolean;
}

/**
 * Pure auto-pause / forgot-to-stop / auto-end state machine.
 *
 * Extracted from `processLocation` so the timer-driven logic can be unit tested
 * with an injected clock. Written as flat guard clauses that each return a
 * {next state, effects, abort} decision — the caller commits the state and
 * dispatches the effects, keeping all GPS/MMKV/Zustand side effects at the
 * boundary.
 */
export function decideAutoPause(
  state: AutoPauseState,
  sample: { rawSpeed: number; pos: { lat: number; lng: number }; accuracy?: number | null },
  subState: string | undefined,
  now: number,
): AutoPauseDecision {
  const next: AutoPauseState = { ...state };
  const { rawSpeed, pos } = sample;
  const creepRadius = Math.max(
    AUTO_PAUSE_DISTANCE_THRESHOLD,
    (sample.accuracy ?? 0) * AUTO_PAUSE_ACCURACY_FACTOR,
  );

  // Moving fast enough — clear any pending stop, banking the pause if it counted.
  if (rawSpeed >= AUTO_PAUSE_SPEED_THRESHOLD) {
    if (!next.zeroSpeedTimer) return { next, effects: [], abort: false, moving: true };
    const pauseDuration = now - next.zeroSpeedTimer;
    const effects: AutoPauseEffect[] =
      pauseDuration > AUTO_PAUSE_DURATION_MS
        ? [
            { kind: 'addAutoPausedMs', ms: pauseDuration },
            { kind: 'setSubState', value: 'moving' },
          ]
        : [];
    // Moving again answers the "still riding?" question — clear the flag so the
    // CarPlay panel drops the prompt without waiting for a notification tap.
    if (state.forgotToStopNotified) {
      effects.push({ kind: 'setForgotToStopPending', value: false });
    }
    next.zeroSpeedTimer = null;
    next.zeroSpeedAnchor = null;
    next.continuousAutoPauseStart = null;
    next.forgotToStopNotified = false;
    return { next, effects, abort: false, moving: true };
  }

  // Slow/stationary — arm the zero-speed timer on the first slow sample.
  if (!next.zeroSpeedTimer) {
    next.zeroSpeedTimer = now;
    next.zeroSpeedAnchor = pos;
  }
  if (!next.zeroSpeedAnchor) return { next, effects: [], abort: true, moving: false };

  // Creeping forward (beyond the jitter radius) re-anchors instead of pausing.
  if (distanceMeters(next.zeroSpeedAnchor, pos) > creepRadius) {
    next.zeroSpeedAnchor = pos;
    next.zeroSpeedTimer = now;

    // This path detects movement just as the speed-threshold branch above does, so it
    // must end the stop episode too. Leaving it armed meant a rider crawling in traffic
    // (>5m per sample, but under the speed threshold) kept a stale
    // `continuousAutoPauseStart`: CarPlay went on asking "STILL RIDING?", a later real
    // stop could not nudge again, and the pre-creep stationary time still counted
    // toward the 30-minute auto-end — enough to end a ride that never stopped moving.
    const effects: AutoPauseEffect[] = [];
    if (next.forgotToStopNotified) {
      effects.push({ kind: 'setForgotToStopPending', value: false });
    }
    // Back to 'moving' so a genuine later stop re-arms the episode from scratch — with
    // the sub-state left at 'stopped', `continuousAutoPauseStart` would never be reset
    // and the rider could never be nudged again for the rest of the ride. Auto-paused
    // time accounting is untouched: this branch never banked it (`zeroSpeedTimer` is
    // reset here), so nothing that was previously counted is lost.
    if (subState === 'stopped') effects.push({ kind: 'setSubState', value: 'moving' });
    next.continuousAutoPauseStart = null;
    next.forgotToStopNotified = false;
    return { next, effects, abort: false, moving: true };
  }

  // Not stopped long enough to auto-pause yet.
  if (now - next.zeroSpeedTimer <= AUTO_PAUSE_DURATION_MS) {
    return { next, effects: [], abort: false, moving: false };
  }

  const effects: AutoPauseEffect[] = [];

  // First tick past the 60s threshold enters the stopped sub-state.
  if (subState !== 'stopped') {
    next.continuousAutoPauseStart = now;
    effects.push({ kind: 'setSubState', value: 'stopped' }, { kind: 'updateSpeedZero' });
  }

  if (!next.continuousAutoPauseStart) return { next, effects, abort: false, moving: false };

  // Forgot-to-stop escalation: flag at 10 min (CarPlay), auto-end at 30 min.
  const stoppedFor = now - next.continuousAutoPauseStart;
  if (stoppedFor > FORGOT_TO_STOP_AUTO_END_MS) {
    effects.push({ kind: 'autoEnd', idleSince: next.continuousAutoPauseStart });
    return { next, effects, abort: true, moving: false };
  }
  if (stoppedFor > FORGOT_TO_STOP_NOTIFY_MS && !next.forgotToStopNotified) {
    next.forgotToStopNotified = true;
    effects.push({ kind: 'setForgotToStopPending', value: true });
  }
  return { next, effects, abort: false, moving: false };
}

// --- Auto-pause effect handlers (dispatch table — no branching at the call site) ---

type AutoPauseEffectHandlers = {
  [K in AutoPauseEffect['kind']]: (effect: Extract<AutoPauseEffect, { kind: K }>) => void;
};

const AUTO_PAUSE_EFFECT_HANDLERS: AutoPauseEffectHandlers = {
  setSubState: (e) => rideMMKV.setRecordingSubState(e.value),
  updateSpeedZero: () => useRideStore.getState().updateSpeed(0),
  addAutoPausedMs: (e) => rideMMKV.setTotalAutoPausedMs(rideMMKV.getTotalAutoPausedMs() + e.ms),
  setForgotToStopPending: (e) => rideMMKV.setForgotToStopPending(e.value),
  autoEnd: (e) => autoEndRide(e.idleSince),
};

function applyAutoPauseEffects(effects: AutoPauseEffect[]): void {
  for (const effect of effects) {
    (AUTO_PAUSE_EFFECT_HANDLERS[effect.kind] as (e: AutoPauseEffect) => void)(effect);
  }
}

// --- Location processing (auto-pause + filtering + stats + waypoint storage) ---

function processLocation(location: Location.LocationObject): void {
  const rideId = rideMMKV.getCurrentId();
  if (!rideId) return;
  // A sample can still arrive between endRide() and stopLocationUpdatesAsync()
  // resolving (the stop is fire-and-forget). Drop it so an ended ride never
  // mutates the store or re-appends to a flushed buffer. Likewise drop samples
  // while MANUALLY paused — a manual pause must freeze distance/speed/waypoints.
  // (Auto-pause keeps status 'recording' with sub-state 'stopped', so it is
  // unaffected and still runs the auto-pause / forgot-to-stop machine below.)
  const rideStatus = useRideStore.getState().status;
  if (rideStatus === 'ended' || rideStatus === 'paused') return;

  const rawSpeed = location.coords.speed ?? 0;
  const currentPos = { lat: location.coords.latitude, lng: location.coords.longitude };

  // Auto-pause: pure decision in, side effects out via the dispatch table.
  const decision = decideAutoPause(
    { zeroSpeedTimer, zeroSpeedAnchor, continuousAutoPauseStart, forgotToStopNotified },
    { rawSpeed, pos: currentPos, accuracy: location.coords.accuracy },
    rideMMKV.getRecordingSubState(),
    Date.now(),
  );
  ({ zeroSpeedTimer, zeroSpeedAnchor, continuousAutoPauseStart, forgotToStopNotified } =
    decision.next);
  applyAutoPauseEffects(decision.effects);
  if (decision.abort) return;

  // First sample this process sees for the ride: load what an earlier process
  // persisted before appending to (and later flushing over) the buffer.
  if (bufferRestoredForRideId !== rideId) {
    if (getPointBuffer().length === 0) restoreBufferFromMMKV(rideId);
    bufferRestoredForRideId = rideId;
  }

  // --- Apply GPS filter (Kalman + smoothing + drift prevention) ---
  const result = gpsFilter.process(
    location.coords.latitude,
    location.coords.longitude,
    location.coords.altitude,
    location.coords.speed,
    location.coords.heading,
    location.coords.accuracy,
    location.timestamp,
  );

  const store = useRideStore.getState();

  // Untrustworthy fix (poor accuracy / teleport / unrealistic speed): the rider
  // may be moving, so leave the readout on its last value.
  if (result.status === 'rejected') return;

  // Stopped rider: drift prevention rejected this sample for distance, but it is
  // a known zero — drop the live speed to 0 now instead of freezing until the
  // 60s auto-pause. Do not accumulate distance/waypoints or advance the anchor.
  if (result.status === 'stationary') {
    store.updateSpeed(0);
    return;
  }

  const filtered = result.location;

  // --- Update live stats in Zustand store ---
  store.updateSpeed(filtered.speed);
  store.updateMaxSpeed(filtered.speed);

  // Accumulate distance
  if (filtered.segmentDistance > 0) {
    store.updateDistance(store.distance + filtered.segmentDistance);
  }

  // Update elevation stats from filter
  const gpsStats = gpsFilter.stats;
  store.updateElevation(
    gpsStats.totalAscent,
    gpsStats.totalDescent,
    filtered.smoothedAltitude ?? 0,
    gpsStats.maxAltitude,
    gpsStats.minAltitude,
  );

  store.updateStopCount(gpsStats.stopCount);

  // --- Write waypoint to in-memory buffer, flush to MMKV chunk at CHUNK_SIZE ---
  const waypoint: Waypoint = {
    latitude: filtered.latitude,
    longitude: filtered.longitude,
    altitude: filtered.smoothedAltitude,
    speedMps: filtered.speed,
    heading: filtered.heading,
    accuracy: filtered.accuracy,
    recordedAt: new Date(location.timestamp).toISOString(),
  };

  // Returns null when the fix was decimated away by the ride's waypoint budget,
  // or when the chunk isn't full yet.
  const flushedChunk = appendWaypoint(rideId, waypoint);
  if (flushedChunk) {
    // Chunk was flushed to MMKV — queue for server upload
    void enqueueWaypointUpload(rideId, flushedChunk);
  }

  // Real movement: push the "still riding?" reminders back (throttled inside). Both
  // conditions: the filter accepted distance AND the stop machine saw movement — the
  // filter alone counts jitter past 1.2x accuracy as distance, which would keep a
  // parked phone's reminders from ever firing.
  if (decision.moving && filtered.segmentDistance > 0) noteRideMovement(location.timestamp);

  // A chunk only reaches disk every 50 points, so a kill used to lose up to 49
  // points — all of a short ride. Persist the partial buffer on a timer too.
  if (location.timestamp - lastBufferFlushAt >= BUFFER_FLUSH_INTERVAL_MS) {
    lastBufferFlushAt = location.timestamp;
    flushBufferToMMKV(rideId);
  }
}

// --- Background task (H10: writes to MMKV, not Zustand) ---

/** What to do with a TaskManager error, keyed by classification. No branching
 *  at the call site — same shape as AUTO_PAUSE_EFFECT_HANDLERS above. */
const LOCATION_TASK_ERROR_HANDLERS: Record<
  LocationTaskErrorAction,
  (error: LocationTaskError) => void
> = {
  // kCLErrorLocationUnknown: Apple says keep waiting, the manager has not
  // stopped. Breadcrumb only, so the context survives into any later real error.
  [LOCATION_TASK_ERROR_ACTION.IGNORE]: (error) => {
    addBreadcrumb(error.message, 'ride-location', { code: error.code });
  },
  [LOCATION_TASK_ERROR_ACTION.REPORT]: (error) => {
    captureException(error, { source: LOCATION_TASK_CAPTURE_SOURCE });
  },
  [LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST]: handleLocationPermissionLost,
};

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      LOCATION_TASK_ERROR_HANDLERS[classifyLocationTaskError(error)](error);
      return;
    }

    // `data` can arrive without `locations` (task woken with no payload); the
    // bare `data.locations` this replaced threw a TypeError inside the headless
    // callback, which is itself a source of synthesised-stack noise.
    for (const location of data?.locations ?? []) {
      processLocation(location);
      onLocationCallback?.(location);
    }
  },
);

// --- Forgot-to-stop helpers ---

/** Exported for tests; production calls it only through the auto-pause effects. */
export function autoEndRide(idleSince: number): void {
  const rideId = rideMMKV.getCurrentId();
  if (!rideId) return;

  const endedAt = new Date(idleSince).toISOString();
  const totalAutoPaused = rideMMKV.getTotalAutoPausedMs();

  // Encode polyline from stored waypoints before clearing
  flushBufferToMMKV(rideId);
  const chunks = getWaypointChunks(rideId);
  const bufferPoints = [...getPointBuffer()];
  const allWaypoints = [...chunks.flat(), ...bufferPoints];
  const polyline =
    allWaypoints.length >= 2
      ? encodePolyline(allWaypoints.map((wp) => [wp.latitude, wp.longitude] as [number, number]))
      : null;

  // distanceM is required server-side (BAD_USER_INPUT otherwise); compute it
  // from the waypoints we already have rather than dropping the field.
  let totalDistance = 0;
  for (let i = 1; i < allWaypoints.length; i++) {
    totalDistance += distanceMeters(
      { lat: allWaypoints[i - 1].latitude, lng: allWaypoints[i - 1].longitude },
      { lat: allWaypoints[i].latitude, lng: allWaypoints[i].longitude },
    );
  }

  // Upload any remaining waypoints that didn't fill a full chunk, then drop the
  // persisted buffer key — the durable copy now lives in the sync queue, so a
  // kill after this point must not let crash-recovery re-enqueue the same points.
  void enqueueWaypointUpload(rideId, bufferPoints);
  removeWaypointBuffer(rideId);

  useRideStore.getState().endRide();
  void stopGPSListener();
  clearPointBuffer();

  enqueueOrExecute('endRide', {
    variables: {
      input: {
        rideId,
        endedAt,
        distanceM: Math.round(totalDistance),
        routePolyline: polyline,
        autoPausedDurationS: Math.round(totalAutoPaused / 1000),
      },
    },
  });

  trackEvent(AnalyticsEvent.RIDE_AUTO_SAVED, {
    ride_id: rideId,
    distance_m: Math.round(totalDistance),
    waypoint_count: allWaypoints.length,
    idle_minutes: Math.round(FORGOT_TO_STOP_AUTO_END_MS / 60_000),
  });

  // This end is headless — no summary screen will ever open to own cleanup. Leaving
  // the ride id behind made the next Start offer "End" on an unfinished ride, which
  // re-sent the end with distance 0 and wiped the distance saved here. Everything
  // the server needs is now in the sync queue, so the local copy can go.
  clearRideData(rideId);

  void Notifications.scheduleNotificationAsync({
    content: rideAutoEndedNotificationContent(rideId),
    trigger: { channelId: NOTIFICATION_CHANNEL.RIDE_ALERTS },
  });
}

/**
 * "We ended your ride" notice after the 30-minute auto-end. `autoEnded: true` sends
 * the tap to the saved ride (handler in _layout), not to a HUD with nothing on it.
 */
export function rideAutoEndedNotificationContent(rideId: string) {
  const minutes = Math.round(FORGOT_TO_STOP_AUTO_END_MS / 60_000);
  return {
    title: i18n.t('rideHud.autoEndedTitle', { defaultValue: 'Ride saved' }),
    body: i18n.t('rideHud.autoEndedBody', {
      minutes,
      defaultValue: `You hadn't moved for ${minutes} minutes, so we ended your ride and saved it up to where you stopped.`,
    }),
    data: { kind: NOTIFICATION_KIND.RIDE_IDLE, rideId, autoEnded: true },
  };
}

/**
 * Content for the "GPS stopped" alert. Reuses NOTIFICATION_KIND.RIDE_IDLE with
 * `autoEnded: false` so the tap lands on the live HUD via the handler already in
 * _layout — deliberately no new notification kind and no new handler branch.
 */
export function gpsPermissionLostNotificationContent(rideId: string | undefined) {
  return {
    title: i18n.t('rideHud.gpsLostTitle', { defaultValue: 'GPS tracking stopped' }),
    body: i18n.t('rideHud.gpsLostBody', {
      defaultValue:
        'Location permission was turned off, so your ride is no longer recording. Tap to fix it or end the ride.',
    }),
    data: { kind: NOTIFICATION_KIND.RIDE_IDLE, rideId, autoEnded: false },
  };
}

/**
 * kCLErrorDenied: the rider revoked location permission mid-ride. iOS has stopped
 * the update stream for good, so nothing else in this module will ever run again
 * for this ride — including the forgot-to-stop escalation in `decideAutoPause`,
 * which is sample-driven and therefore unreachable once the stream dies.
 *
 * The ride is deliberately NOT ended: the rider may still be riding, the buffered
 * waypoints are real, and re-granting permission should be able to resume. Mark
 * the state, tell the rider once, report once.
 */
function handleLocationPermissionLost(error: LocationTaskError): void {
  if (permissionLostReported) return;
  permissionLostReported = true;

  rideMMKV.setGpsPermissionLost(true);
  useRideStore.getState().setGpsPermissionLost(true);

  captureException(error, {
    source: LOCATION_TASK_CAPTURE_SOURCE,
    coreLocationCode: CORE_LOCATION_ERROR_CODE.DENIED,
    rideId: rideMMKV.getCurrentId(),
  });

  void Notifications.scheduleNotificationAsync({
    content: gpsPermissionLostNotificationContent(rideMMKV.getCurrentId()),
    trigger: { channelId: NOTIFICATION_CHANNEL.RIDE_ALERTS },
  });
}

function resetAutoPauseState(): void {
  zeroSpeedTimer = null;
  zeroSpeedAnchor = null;
  continuousAutoPauseStart = null;
  forgotToStopNotified = false;
  permissionLostReported = false;
  lastBufferFlushAt = 0;
  bufferRestoredForRideId = null;
  // Persisted flags must die with the session too, or the next ride's CarPlay panel
  // opens already showing "STILL RIDING?" from a previous ride's stop — and the HUD
  // opens already warning that GPS is off.
  rideMMKV.setForgotToStopPending(false);
  rideMMKV.setGpsPermissionLost(false);
}
