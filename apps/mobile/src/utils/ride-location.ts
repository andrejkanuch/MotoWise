import type { Waypoint } from '@motovault/types';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { captureException } from '../lib/analytics';
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
import { enqueueOrExecute } from './ride-sync-queue';

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

let locationSubscription: Location.LocationSubscription | null = null;
let onLocationCallback: ((location: Location.LocationObject) => void) | null = null;

export async function startGPSListener(
  onLocation: (location: Location.LocationObject) => void,
): Promise<void> {
  onLocationCallback = onLocation;
  // Restore any in-memory buffer from MMKV (crash recovery)
  const rideId = rideMMKV.getCurrentId();
  if (rideId) restoreBufferFromMMKV(rideId);

  // Reset GPS filter for fresh ride
  gpsFilter.reset();

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 1000,
      mayShowUserSettingsDialog: false,
    },
    (location) => {
      processLocation(location);
      onLocation(location);
    },
  );
}

export function stopGPSListener(): void {
  // Flush in-memory buffer to MMKV before stopping
  const rideId = rideMMKV.getCurrentId();
  if (rideId) flushBufferToMMKV(rideId);

  locationSubscription?.remove();
  locationSubscription = null;
  resetAutoPauseState();
}

export async function toggleBatterySaver(enabled: boolean): Promise<void> {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: enabled ? Location.Accuracy.Balanced : Location.Accuracy.BestForNavigation,
        distanceInterval: enabled ? 15 : 5,
        timeInterval: enabled ? 5000 : 1000,
        mayShowUserSettingsDialog: false,
      },
      (location) => {
        processLocation(location);
        onLocationCallback?.(location);
      },
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
    return { next, effects: [], abort: false };
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
    effects.push({ kind: 'notifyForgotToStop' });
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
  const filtered = gpsFilter.process(
    location.coords.latitude,
    location.coords.longitude,
    location.coords.altitude,
    location.coords.speed,
    location.coords.heading,
    location.coords.accuracy,
    location.timestamp,
  );

  // If the filter rejects the point (poor accuracy, drift, teleport), skip it
  if (!filtered) return;

  // --- Update live stats in Zustand store ---
  const store = useRideStore.getState();
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

  const flushedChunk = appendWaypoint(rideId, waypoint);
  if (flushedChunk) {
    // Chunk was flushed to MMKV — queue for server upload
    enqueueOrExecute('uploadWaypoints', {
      variables: { input: { rideId, waypoints: flushedChunk } },
    });
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
  if (bufferPoints.length > 0) {
    enqueueOrExecute('uploadWaypoints', {
      variables: { input: { rideId, waypoints: bufferPoints } },
    });
  }
  removeWaypointBuffer(rideId);

  useRideStore.getState().endRide();
  stopGPSListener();
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

async function showForgotToStopNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Still riding?',
      body: "You've been stopped for 10 minutes. Tap to end your ride or keep going.",
    },
    trigger: null,
  });
}

function resetAutoPauseState(): void {
  zeroSpeedTimer = null;
  zeroSpeedAnchor = null;
  continuousAutoPauseStart = null;
  forgotToStopNotified = false;
}
