import type { Waypoint } from '@motovault/types';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { useRideStore } from '../stores/ride.store';
import { gpsFilter } from './ride-gps-filter';
import { encodePolyline } from './ride-heatmap';
import {
  appendWaypoint,
  clearPointBuffer,
  flushBufferToMMKV,
  getPointBuffer,
  getWaypointChunks,
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

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
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

// --- Location processing (auto-pause + filtering + stats + waypoint storage) ---

function processLocation(location: Location.LocationObject): void {
  const rideId = rideMMKV.getCurrentId();
  if (!rideId) return;

  const rawSpeed = location.coords.speed ?? 0;
  const currentPos = { lat: location.coords.latitude, lng: location.coords.longitude };

  // --- Auto-pause logic ---
  if (rawSpeed < AUTO_PAUSE_SPEED_THRESHOLD) {
    if (!zeroSpeedTimer) {
      zeroSpeedTimer = Date.now();
      zeroSpeedAnchor = currentPos;
    }

    if (!zeroSpeedAnchor) return;
    const delta = distanceMeters(zeroSpeedAnchor, currentPos);
    const stoppedDuration = Date.now() - zeroSpeedTimer;

    if (delta > AUTO_PAUSE_DISTANCE_THRESHOLD) {
      // Rider maneuvering slowly — reset anchor
      zeroSpeedAnchor = currentPos;
      zeroSpeedTimer = Date.now();
    } else if (stoppedDuration > AUTO_PAUSE_DURATION_MS) {
      const subState = rideMMKV.getRecordingSubState();
      if (subState !== 'stopped') {
        rideMMKV.setRecordingSubState('stopped');
        continuousAutoPauseStart = Date.now();
        useRideStore.getState().updateSpeed(0);
      }

      // Forgot-to-stop detection
      if (continuousAutoPauseStart) {
        const autoPauseDuration = Date.now() - continuousAutoPauseStart;

        if (autoPauseDuration > FORGOT_TO_STOP_AUTO_END_MS) {
          autoEndRide(continuousAutoPauseStart);
          return;
        }
        if (autoPauseDuration > FORGOT_TO_STOP_NOTIFY_MS && !forgotToStopNotified) {
          showForgotToStopNotification();
          forgotToStopNotified = true;
        }
      }
    }
  } else {
    // Moving again
    if (zeroSpeedTimer) {
      const pauseDuration = Date.now() - zeroSpeedTimer;
      if (pauseDuration > AUTO_PAUSE_DURATION_MS) {
        // Was in STOPPED; accumulate auto-pause duration
        const prev = rideMMKV.getTotalAutoPausedMs();
        rideMMKV.setTotalAutoPausedMs(prev + pauseDuration);
        rideMMKV.setRecordingSubState('moving');
      }
      zeroSpeedTimer = null;
      zeroSpeedAnchor = null;
      continuousAutoPauseStart = null;
      forgotToStopNotified = false;
    }
  }

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
      console.error('Background GPS error:', error);
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

  // Upload any remaining waypoints that didn't fill a full chunk
  if (bufferPoints.length > 0) {
    enqueueOrExecute('uploadWaypoints', {
      variables: { input: { rideId, waypoints: bufferPoints } },
    });
  }

  useRideStore.getState().endRide();
  stopGPSListener();
  clearPointBuffer();

  enqueueOrExecute('endRide', {
    variables: {
      input: {
        rideId,
        endedAt,
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
