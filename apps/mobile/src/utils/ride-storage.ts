import type { Waypoint } from '@motovault/types';
import { MMKV } from 'react-native-mmkv';

export const rideStorage = new MMKV({ id: 'ride-storage' });

// --- Key constants ---

export const RIDE_KEYS = {
  CURRENT_ID: 'ride.current_id',
  STATUS: 'ride.status',
  STARTED_AT: 'ride.started_at',
  TOTAL_PAUSED_MS: 'ride.total_paused_ms',
  TOTAL_AUTO_PAUSED_MS: 'ride.total_auto_paused_ms',
  RECORDING_SUB_STATE: 'ride.recording_sub_state',
  PERMISSION_LEVEL: 'ride.permission_level',
} as const;

const waypointChunkKey = (rideId: string, chunkIndex: number) => `ride:${rideId}:wp:${chunkIndex}`;

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

  // Paused duration
  getTotalPausedMs: () => rideStorage.getNumber(RIDE_KEYS.TOTAL_PAUSED_MS) ?? 0,
  setTotalPausedMs: (ms: number) => rideStorage.set(RIDE_KEYS.TOTAL_PAUSED_MS, ms),

  // Auto-paused duration
  getTotalAutoPausedMs: () => rideStorage.getNumber(RIDE_KEYS.TOTAL_AUTO_PAUSED_MS) ?? 0,
  setTotalAutoPausedMs: (ms: number) => rideStorage.set(RIDE_KEYS.TOTAL_AUTO_PAUSED_MS, ms),

  // Recording sub-state
  getRecordingSubState: () =>
    rideStorage.getString(RIDE_KEYS.RECORDING_SUB_STATE) as 'moving' | 'stopped' | undefined,
  setRecordingSubState: (state: 'moving' | 'stopped') =>
    rideStorage.set(RIDE_KEYS.RECORDING_SUB_STATE, state),

  // Permission level
  getPermissionLevel: () =>
    rideStorage.getString(RIDE_KEYS.PERMISSION_LEVEL) as
      | 'full'
      | 'foreground_only'
      | 'denied'
      | undefined,
  setPermissionLevel: (level: 'full' | 'foreground_only' | 'denied') =>
    rideStorage.set(RIDE_KEYS.PERMISSION_LEVEL, level),
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
  rideStorage.set(`ride:${rideId}:wp:buffer`, JSON.stringify(pointBuffer));
}

export function restoreBufferFromMMKV(rideId: string): void {
  const raw = rideStorage.getString(`ride:${rideId}:wp:buffer`);
  if (raw) {
    pointBuffer = JSON.parse(raw) as Waypoint[];
    rideStorage.delete(`ride:${rideId}:wp:buffer`);
  }
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
    chunks.push(JSON.parse(raw) as Waypoint[]);
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
    rideStorage.delete(waypointChunkKey(rideId, i));
    i++;
  }
  // Clear waypoint buffer
  rideStorage.delete(`ride:${rideId}:wp:buffer`);
  // Clear ride-level keys
  for (const key of Object.values(RIDE_KEYS)) {
    rideStorage.delete(key);
  }
  // Clear in-memory buffer
  pointBuffer = [];
}
