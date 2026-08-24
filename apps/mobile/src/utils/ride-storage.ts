import { RIDE_WAYPOINT_LIMITS, type Waypoint } from '@motovault/types';
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
  WAYPOINT_COUNT: 'ride.waypoint_count',
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

  // Waypoints this ride has banked for upload. PERSISTED because it mirrors rows
  // the server now holds: a headless relaunch after an app kill keeps recording
  // into the same ride, and an in-memory counter would restart the budget from
  // zero and walk straight past the cap.
  getWaypointCount: () => rideStorage.getNumber(RIDE_KEYS.WAYPOINT_COUNT) ?? 0,
  setWaypointCount: (count: number) => rideStorage.set(RIDE_KEYS.WAYPOINT_COUNT, count),
} as const;

// --- Waypoint budget (client-side cap + progressive decimation) ---

/**
 * How many GPS fixes to skip per kept waypoint, given how many this ride has
 * already banked.
 *
 * The server caps a ride at `MAX_PER_RIDE` and permanently rejects anything past
 * it, so an uncapped recorder does not merely lose points — it mints a payload
 * that can never be accepted every time a chunk fills, for the rest of the ride
 * (MOTO-VAULT-REACT-NATIVE-1M). Simply stopping at the cap would instead truncate
 * the track: a rider who passes it loses the entire back half of their route.
 *
 * So the budget is spent geometrically. Each tier consumes half of what is left at
 * twice the stride, so every tier covers twice as much riding as the one before
 * while the running total converges on the cap and never reaches it:
 *
 *   stride 1 for the first 5,000 points, 2 for the next 2,500, 4 for the next
 *   1,250, and so on — at the ~1 fix/sec this recorder is configured for
 *   (expo-location timeInterval 1000 / distanceInterval 5), each of those tiers
 *   is roughly 80 minutes of riding.
 *
 * The budget is denominated in POINTS, not seconds, so the invariant holds at any
 * capture rate — the minutes above are only there to show the shape. Full
 * resolution for every ride a person actually takes, graceful thinning past that,
 * and a hard stop (Infinity) only if the cap is somehow still reached.
 *
 * Decimating here rather than lowering the capture rate is deliberate: coarser
 * expo-location options would cost every ride fidelity to fix a problem that only
 * appears after ~3 hours, and this recorder cannot switch to the cheaper
 * watchPositionAsync anyway — that API is foreground-only and would stop recording
 * the moment the screen locks.
 */
export function waypointRecordingStride(recorded: number): number {
  const cap = RIDE_WAYPOINT_LIMITS.MAX_PER_RIDE;
  if (recorded >= cap) return Number.POSITIVE_INFINITY;
  let stride = 1;
  let threshold = cap / 2;
  while (recorded >= threshold) {
    stride *= 2;
    threshold += (cap - threshold) / 2;
  }
  return stride;
}

// Fixes seen since the last kept one. Deliberately NOT persisted: it only sets the
// sampling phase, so losing it to an app kill re-phases the sampling and nothing
// else. The count that must survive is the banked total, which lives in MMKV.
let fixesSinceKept = 0;

/** Reset the per-ride waypoint budget. Call when a fresh ride starts. */
export function resetWaypointBudget(): void {
  fixesSinceKept = 0;
  rideMMKV.setWaypointCount(0);
}

// --- In-memory waypoint buffer ---
// Avoids JSON parse/serialize on every GPS callback.
// Flushed to MMKV chunk when it reaches CHUNK_SIZE.

let pointBuffer: Waypoint[] = [];

export function appendWaypoint(rideId: string, waypoint: Waypoint): Waypoint[] | null {
  // Spend the ride's waypoint budget before touching the buffer — a point the
  // budget cannot afford must never reach the sync queue, because the server
  // rejects it permanently. See waypointRecordingStride.
  const recorded = rideMMKV.getWaypointCount();
  const stride = waypointRecordingStride(recorded);
  if (!Number.isFinite(stride)) return null;
  fixesSinceKept++;
  if (fixesSinceKept < stride) return null;
  fixesSinceKept = 0;

  pointBuffer.push(waypoint);
  rideMMKV.setWaypointCount(recorded + 1);

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
  // Clear in-memory buffer + the budget that tracked it
  pointBuffer = [];
  fixesSinceKept = 0;
}
