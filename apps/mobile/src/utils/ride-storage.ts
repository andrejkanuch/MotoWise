import type { Waypoint } from '@motovault/types';
import { createMMKV } from 'react-native-mmkv';

// Lazy-loaded on the (rare) corruption path only, so this low-level storage
// primitive doesn't pull the analytics/Sentry bundle into its import graph.
function reportCorruption(err: unknown, context: Record<string, unknown>): void {
  // .catch keeps a failed analytics import from becoming an unhandled rejection
  // (matches the lazy-import guards in lib/analytics).
  void import('../lib/analytics')
    .then(({ captureException }) => captureException(err, context))
    .catch(() => {});
}

export const rideStorage = createMMKV({ id: 'ride-storage' });

// --- Key constants ---

export const RIDE_KEYS = {
  CURRENT_ID: 'ride.current_id',
  STATUS: 'ride.status',
  STARTED_AT: 'ride.started_at',
  MOTORCYCLE_ID: 'ride.motorcycle_id',
  TOTAL_PAUSED_MS: 'ride.total_paused_ms',
  PAUSED_AT: 'ride.paused_at',
  TOTAL_AUTO_PAUSED_MS: 'ride.total_auto_paused_ms',
  RECORDING_SUB_STATE: 'ride.recording_sub_state',
  FORGOT_TO_STOP_PENDING: 'ride.forgot_to_stop_pending',
  PERMISSION_LEVEL: 'ride.permission_level',
  HUD_LAYOUT: 'ride.hud_layout',
} as const;

const waypointChunkKey = (rideId: string, chunkIndex: number) => `ride:${rideId}:wp:${chunkIndex}`;
const waypointBufferKey = (rideId: string) => `ride:${rideId}:wp:buffer`;

export const CHUNK_SIZE = 50;

// --- Typed MMKV wrapper ---

export const rideMMKV = {
  // Current ride ID
  getCurrentId: () => rideStorage.getString(RIDE_KEYS.CURRENT_ID),
  setCurrentId: (id: string) => rideStorage.set(RIDE_KEYS.CURRENT_ID, id),

  // Ride status (persisted for crash recovery hydration)
  getStatus: () => rideStorage.getString(RIDE_KEYS.STATUS) as 'recording' | 'paused' | undefined,
  setStatus: (status: 'recording' | 'paused') => rideStorage.set(RIDE_KEYS.STATUS, status),

  // Started at (epoch ms)
  getStartedAt: () => rideStorage.getNumber(RIDE_KEYS.STARTED_AT),
  setStartedAt: (ms: number) => rideStorage.set(RIDE_KEYS.STARTED_AT, ms),

  // Motorcycle ID (for post-ride features)
  getMotorcycleId: () => rideStorage.getString(RIDE_KEYS.MOTORCYCLE_ID),
  setMotorcycleId: (id: string) => rideStorage.set(RIDE_KEYS.MOTORCYCLE_ID, id),

  // Paused duration
  getTotalPausedMs: () => rideStorage.getNumber(RIDE_KEYS.TOTAL_PAUSED_MS) ?? 0,
  setTotalPausedMs: (ms: number) => rideStorage.set(RIDE_KEYS.TOTAL_PAUSED_MS, ms),

  // Epoch ms when the current MANUAL pause began; 0 = not paused. The engine-owned
  // pause clock: pauseRide stamps it, resumeRide banks (now - pausedAt) into
  // TOTAL_PAUSED_MS and resets it. Lets elapsed time freeze during a pause from any
  // surface (phone HUD or CarPlay) without a mounted UI timer.
  getPausedAt: () => rideStorage.getNumber(RIDE_KEYS.PAUSED_AT) ?? 0,
  setPausedAt: (ms: number) => rideStorage.set(RIDE_KEYS.PAUSED_AT, ms),

  // Auto-paused duration
  getTotalAutoPausedMs: () => rideStorage.getNumber(RIDE_KEYS.TOTAL_AUTO_PAUSED_MS) ?? 0,
  setTotalAutoPausedMs: (ms: number) => rideStorage.set(RIDE_KEYS.TOTAL_AUTO_PAUSED_MS, ms),

  // Recording sub-state
  getRecordingSubState: () =>
    rideStorage.getString(RIDE_KEYS.RECORDING_SUB_STATE) as 'moving' | 'stopped' | undefined,
  setRecordingSubState: (state: 'moving' | 'stopped') =>
    rideStorage.set(RIDE_KEYS.RECORDING_SUB_STATE, state),

  // True once a ride has been continuously auto-paused past the forgot-to-stop
  // threshold, until it moves again. `recordingSubState: 'stopped'` alone can't
  // express this — that flips after 60s, which is just a traffic light. The
  // duration lives in ride-location's module state, so this persists the crossing
  // for surfaces that only see MMKV (the CarPlay panel, which re-derives on a
  // timer and after the phone screen locks).
  getForgotToStopPending: () => rideStorage.getBoolean(RIDE_KEYS.FORGOT_TO_STOP_PENDING) ?? false,
  setForgotToStopPending: (pending: boolean) =>
    rideStorage.set(RIDE_KEYS.FORGOT_TO_STOP_PENDING, pending),

  // Permission level
  getPermissionLevel: () =>
    rideStorage.getString(RIDE_KEYS.PERMISSION_LEVEL) as
      | 'full'
      | 'foreground_only'
      | 'denied'
      | undefined,
  setPermissionLevel: (level: 'full' | 'foreground_only' | 'denied') =>
    rideStorage.set(RIDE_KEYS.PERMISSION_LEVEL, level),

  // HUD layout preference
  getHudLayout: () => (rideStorage.getString(RIDE_KEYS.HUD_LAYOUT) as 'A' | 'B' | undefined) ?? 'A',
  setHudLayout: (layout: 'A' | 'B') => rideStorage.set(RIDE_KEYS.HUD_LAYOUT, layout),
} as const;

// --- In-memory waypoint buffer ---
// Avoids JSON parse/serialize on every GPS callback.
// Flushed to MMKV chunk when it reaches CHUNK_SIZE.

let pointBuffer: Waypoint[] = [];

export function appendWaypoint(rideId: string, waypoint: Waypoint): Waypoint[] | null {
  pointBuffer.push(waypoint);

  if (pointBuffer.length >= CHUNK_SIZE) {
    const chunk = pointBuffer;
    const chunkIndex = getNextChunkIndex(rideId);
    rideStorage.set(waypointChunkKey(rideId, chunkIndex), JSON.stringify(chunk));
    pointBuffer = [];
    return chunk; // Caller should queue for upload
  }

  return null; // Not yet full
}

export function flushBufferToMMKV(rideId: string): void {
  if (pointBuffer.length === 0) return;
  // Save partial buffer so it survives app kill
  rideStorage.set(waypointBufferKey(rideId), JSON.stringify(pointBuffer));
}

export function restoreBufferFromMMKV(rideId: string): void {
  const raw = rideStorage.getString(waypointBufferKey(rideId));
  if (!raw) return;
  // Crash-recovery path: the blob may be partially written (app killed
  // mid-flush) — a throwing JSON.parse here would defeat the very recovery it
  // exists for. Drop the corrupt key and keep the in-memory buffer intact.
  try {
    pointBuffer = JSON.parse(raw) as Waypoint[];
  } catch (err) {
    reportCorruption(err, { source: 'ride-storage.restoreBufferFromMMKV', rideId });
  } finally {
    rideStorage.remove(waypointBufferKey(rideId));
  }
}

/**
 * Remove the persisted partial-buffer key. Call on the graceful/auto end path
 * right after the in-memory buffer has been enqueued for upload, so a kill after
 * end does not let `restoreBufferFromMMKV` re-enqueue the same points (duplicate
 * waypoints). The durable copy now lives in the sync queue, not here.
 */
export function removeWaypointBuffer(rideId: string): void {
  rideStorage.remove(waypointBufferKey(rideId));
}

export function getPointBuffer(): readonly Waypoint[] {
  return pointBuffer;
}

export function clearPointBuffer(): void {
  pointBuffer = [];
}

// --- Chunk read helpers ---

export function getWaypointChunks(rideId: string): Waypoint[][] {
  const chunks: Waypoint[][] = [];
  let i = 0;
  while (true) {
    const raw = rideStorage.getString(waypointChunkKey(rideId, i));
    if (!raw) break;
    // Skip a corrupt chunk rather than throwing, so surviving chunks still
    // upload instead of losing the whole recorded ride.
    try {
      chunks.push(JSON.parse(raw) as Waypoint[]);
    } catch (err) {
      reportCorruption(err, { source: 'ride-storage.getWaypointChunks', rideId, chunkIndex: i });
    }
    i++;
  }
  return chunks;
}

export function getNextChunkIndex(rideId: string): number {
  let i = 0;
  while (rideStorage.getString(waypointChunkKey(rideId, i))) {
    i++;
  }
  return i;
}

// --- Cleanup ---

export function clearRideData(rideId: string): void {
  // Clear waypoint chunks
  let i = 0;
  while (rideStorage.getString(waypointChunkKey(rideId, i))) {
    rideStorage.remove(waypointChunkKey(rideId, i));
    i++;
  }
  // Clear waypoint buffer
  rideStorage.remove(waypointBufferKey(rideId));
  // Clear ride-level keys
  for (const key of Object.values(RIDE_KEYS)) {
    rideStorage.remove(key);
  }
  // Clear in-memory buffer
  pointBuffer = [];
}
