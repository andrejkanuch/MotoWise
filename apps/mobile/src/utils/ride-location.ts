import type { Waypoint } from '@motovault/types';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { useRideStore } from '../stores/ride.store';
import {
  appendWaypoint,
  clearPointBuffer,
  flushBufferToMMKV,
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

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5000,
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
        accuracy: enabled ? Location.Accuracy.Balanced : Location.Accuracy.High,
        distanceInterval: enabled ? 20 : 10,
        timeInterval: enabled ? 10000 : 5000,
        mayShowUserSettingsDialog: false,
      },
      (location) => {
        processLocation(location);
        onLocationCallback?.(location);
      },
    );
  }
}

// --- Location processing (auto-pause + waypoint storage) ---

function processLocation(location: Location.LocationObject): void {
  const rideId = rideMMKV.getCurrentId();
  if (!rideId) return;

  const speedMps = location.coords.speed ?? 0;
  const currentPos = { lat: location.coords.latitude, lng: location.coords.longitude };

  // --- Auto-pause logic ---
  if (speedMps < AUTO_PAUSE_SPEED_THRESHOLD) {
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
        } else if (autoPauseDuration > FORGOT_TO_STOP_NOTIFY_MS && !forgotToStopNotified) {
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

  // --- Write waypoint to in-memory buffer, flush to MMKV chunk at CHUNK_SIZE ---
  const waypoint: Waypoint = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude,
    speedMps: location.coords.speed ?? 0,
    heading: location.coords.heading ?? 0,
    accuracy: location.coords.accuracy ?? 0,
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

  useRideStore.getState().endRide();
  stopGPSListener();
  clearPointBuffer();

  enqueueOrExecute('endRide', {
    variables: {
      input: {
        rideId,
        endedAt,
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
