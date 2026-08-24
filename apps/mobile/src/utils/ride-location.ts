import { palette } from '@motovault/design-system';
import type { Waypoint } from '@motovault/types';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18n from '../i18n';
import { captureException } from '../lib/analytics';
import { NOTIFICATION_KIND } from '../lib/notifications';
import { useRideStore } from '../stores/ride.store';
import { haversineMeters } from './geo-utils';
import { gpsFilter } from './ride-gps-filter';
import { encodePolyline } from './ride-heatmap';
import {
  appendWaypoint,
  clearPointBuffer,
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

const FORGOT_TO_STOP_NOTIFY_MS = 10 * 60 * 1000; // 10 min
const FORGOT_TO_STOP_AUTO_END_MS = 30 * 60 * 1000; // 30 min
const AUTO_PAUSE_SPEED_THRESHOLD = 0.5; // m/s
const AUTO_PAUSE_DISTANCE_THRESHOLD = 5; // meters
const AUTO_PAUSE_DURATION_MS = 60_000; // 60 seconds

// --- Auto-pause state (module-level, survives across callbacks) ---

let zeroSpeedTimer: number | null = null;
let zeroSpeedAnchor: { lat: number; lng: number } | null = null;
let continuousAutoPauseStart: number | null = null;
let forgotToStopNotified = false;

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
      notificationTitle: 'MotoVault is recording your ride',
      notificationBody: 'Tap to return to your ride.',
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
  if (rideId) restoreBufferFromMMKV(rideId);

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
  | { kind: 'notifyForgotToStop' }
  /** Persist/clear the "probably forgot to stop" flag for other surfaces (CarPlay). */
  | { kind: 'setForgotToStopPending'; value: boolean }
  | { kind: 'autoEnd'; idleSince: number };

export interface AutoPauseDecision {
  next: AutoPauseState;
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
  sample: { rawSpeed: number; pos: { lat: number; lng: number } },
  subState: string | undefined,
  now: number,
): AutoPauseDecision {
  const next: AutoPauseState = { ...state };
  const { rawSpeed, pos } = sample;

  // Moving fast enough — clear any pending stop, banking the pause if it counted.
  if (rawSpeed >= AUTO_PAUSE_SPEED_THRESHOLD) {
    if (!next.zeroSpeedTimer) return { next, effects: [], abort: false };
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
    return { next, effects, abort: false };
  }

  // Slow/stationary — arm the zero-speed timer on the first slow sample.
  if (!next.zeroSpeedTimer) {
    next.zeroSpeedTimer = now;
    next.zeroSpeedAnchor = pos;
  }
  if (!next.zeroSpeedAnchor) return { next, effects: [], abort: true };

  // Creeping forward (>5m) re-anchors instead of pausing.
  if (distanceMeters(next.zeroSpeedAnchor, pos) > AUTO_PAUSE_DISTANCE_THRESHOLD) {
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
    return { next, effects, abort: false };
  }

  // Not stopped long enough to auto-pause yet.
  if (now - next.zeroSpeedTimer <= AUTO_PAUSE_DURATION_MS) {
    return { next, effects: [], abort: false };
  }

  const effects: AutoPauseEffect[] = [];

  // First tick past the 60s threshold enters the stopped sub-state.
  if (subState !== 'stopped') {
    next.continuousAutoPauseStart = now;
    effects.push({ kind: 'setSubState', value: 'stopped' }, { kind: 'updateSpeedZero' });
  }

  if (!next.continuousAutoPauseStart) return { next, effects, abort: false };

  // Forgot-to-stop escalation: notify at 10 min, auto-end at 30 min.
  const stoppedFor = now - next.continuousAutoPauseStart;
  if (stoppedFor > FORGOT_TO_STOP_AUTO_END_MS) {
    effects.push({ kind: 'autoEnd', idleSince: next.continuousAutoPauseStart });
    return { next, effects, abort: true };
  }
  if (stoppedFor > FORGOT_TO_STOP_NOTIFY_MS && !next.forgotToStopNotified) {
    next.forgotToStopNotified = true;
    effects.push({ kind: 'notifyForgotToStop' }, { kind: 'setForgotToStopPending', value: true });
  }
  return { next, effects, abort: false };
}

// --- Auto-pause effect handlers (dispatch table — no branching at the call site) ---

type AutoPauseEffectHandlers = {
  [K in AutoPauseEffect['kind']]: (effect: Extract<AutoPauseEffect, { kind: K }>) => void;
};

const AUTO_PAUSE_EFFECT_HANDLERS: AutoPauseEffectHandlers = {
  setSubState: (e) => rideMMKV.setRecordingSubState(e.value),
  updateSpeedZero: () => useRideStore.getState().updateSpeed(0),
  addAutoPausedMs: (e) => rideMMKV.setTotalAutoPausedMs(rideMMKV.getTotalAutoPausedMs() + e.ms),
  notifyForgotToStop: () => {
    void showForgotToStopNotification();
  },
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
    { rawSpeed, pos: currentPos },
    rideMMKV.getRecordingSubState(),
    Date.now(),
  );
  ({ zeroSpeedTimer, zeroSpeedAnchor, continuousAutoPauseStart, forgotToStopNotified } =
    decision.next);
  applyAutoPauseEffects(decision.effects);
  if (decision.abort) return;

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
}

// --- Background task (H10: writes to MMKV, not Zustand) ---

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
  BACKGROUND_LOCATION_TASK,
  async ({ data, error }) => {
    if (error) {
      captureException(error, { source: 'ride-location.backgroundLocationTask' });
      return;
    }

    for (const location of data.locations) {
      processLocation(location);
      onLocationCallback?.(location);
    }
  },
);

// --- Forgot-to-stop helpers ---

function autoEndRide(idleSince: number): void {
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
}

/**
 * Content for the local "still riding?" nudge. Pure + exported so the payload can
 * be asserted in tests — the `kind` is what makes the notification routable.
 *
 * `data.kind` matters: without it the tap handler in _layout fell through to its
 * `if (!data?.taskId) return` guard, so tapping this notification did nothing at
 * all. The shape mirrors the server sweep's push (@motovault/types
 * NOTIFICATION_KIND.RIDE_IDLE) so a single handler branch covers both sources.
 *
 * Copy goes through i18n rather than being inlined: this is rider-facing text and
 * the app ships 13 locales. `defaultValue` keeps the English wording if the key is
 * ever missing from a bundle, matching the quick-actions pattern in _layout.
 */
export function forgotToStopNotificationContent(
  rideId: string | undefined,
  notifyAfterMs: number = FORGOT_TO_STOP_NOTIFY_MS,
) {
  const minutes = Math.round(notifyAfterMs / 60_000);
  return {
    title: i18n.t('rideHud.forgotToStopTitle', { defaultValue: 'Still riding?' }),
    body: i18n.t('rideHud.forgotToStopBody', {
      minutes,
      defaultValue: `You've been stopped for ${minutes} minutes. Tap to end your ride or keep going.`,
    }),
    data: { kind: NOTIFICATION_KIND.RIDE_IDLE, rideId, autoEnded: false },
  };
}

/** Fired once per continuous stop by `decideAutoPause`'s `notifyForgotToStop` effect. */
async function showForgotToStopNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: forgotToStopNotificationContent(rideMMKV.getCurrentId()),
    trigger: null,
  });
}

function resetAutoPauseState(): void {
  zeroSpeedTimer = null;
  zeroSpeedAnchor = null;
  continuousAutoPauseStart = null;
  forgotToStopNotified = false;
  // Persisted flag must die with the session too, or the next ride's CarPlay panel
  // opens already showing "STILL RIDING?" from a previous ride's stop.
  rideMMKV.setForgotToStopPending(false);
}
