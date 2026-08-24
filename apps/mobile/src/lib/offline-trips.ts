/**
 * Per-trip offline packs.
 *
 * Glues two independent systems together:
 *   1. Mapbox `offlineManager` — downloads and stores vector tiles for the
 *      trip's bounding box at ride-relevant zoom levels.
 *   2. MMKV registry — remembers which trips the user has opted offline,
 *      their pack name, download timestamp, and a cached copy of the trip
 *      payload so the detail screen renders without a network hit.
 *
 * Trip payload caching piggy-backs on the TanStack Query persistor in a
 * separate namespace so invalidations to the regular query cache don't nuke
 * the user's offline stash.
 */

import MapboxGL from '@rnmapbox/maps';
import * as Crypto from 'expo-crypto';
import { createMMKV } from 'react-native-mmkv';
import {
  readSecureItemSync,
  SECURE_STORE_KEY,
  SECURE_STORE_STATUS,
  setSecureItemSync,
} from './secure-store';

const OFFLINE_STORE_ID = 'offline-trips-v1';
/** Bytes of entropy in the per-install MMKV encryption key. */
const MMKV_KEY_BYTES = 32;

/**
 * Pulls (or lazily generates) a per-install encryption key from the keychain.
 *
 * Returns null when the keychain is unreadable — which happens for real on a
 * background launch with the screen locked (MOTO-VAULT-REACT-NATIVE-2D). A
 * `locked`/`failed` read must NEVER fall through to minting a fresh key: that
 * would re-encrypt the store under a new key and orphan the rider's existing
 * offline packs. Only a definitive "no such item" generates one.
 */
function readOrCreateMmkvKey(): string | null {
  const stored = readSecureItemSync(SECURE_STORE_KEY.OFFLINE_MMKV_KEY);
  if (stored.value) return stored.value;
  if (stored.status !== SECURE_STORE_STATUS.OK) return null;

  const key = Array.from(Crypto.getRandomBytes(MMKV_KEY_BYTES))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return setSecureItemSync(SECURE_STORE_KEY.OFFLINE_MMKV_KEY, key) ? key : null;
}

type OfflineStore = ReturnType<typeof createMMKV>;

let offlineStore: OfflineStore | null = null;

/**
 * The encrypted MMKV handle, created on first use rather than at module load —
 * reading the key at import time turned a locked keychain into a bundle-level
 * throw. Returns null while the key is unavailable; every offline feature then
 * degrades to "nothing cached" and retries on the next call.
 */
function getOfflineStore(): OfflineStore | null {
  if (offlineStore) return offlineStore;
  const encryptionKey = readOrCreateMmkvKey();
  if (!encryptionKey) return null;
  offlineStore = createMMKV({ id: OFFLINE_STORE_ID, encryptionKey });
  return offlineStore;
}

const PACK_NAME = (tripId: string) => `trip-${tripId}`;
const REGISTRY_KEY = 'registry';
const PAYLOAD_KEY = (tripId: string) => `payload:${tripId}`;

/**
 * Conservative zoom range — highway-level detail without blowing up disk.
 *
 * maxZoom was 14 but that quadruples tile count vs. 12 (each +1 zoom = 4×
 * tiles per area). 12 still renders street names & turn geometry clearly at
 * riding speeds; go higher only for a deliberate "hi-res pack" opt-in.
 */
export const OFFLINE_MIN_ZOOM = 8;
export const OFFLINE_MAX_ZOOM = 12;

/**
 * Hard cap on tile count per pack. Mapbox free tier allows 750 MAU tile
 * packs; paid tier is $0.15/1k tiles afterwards. 5k tiles ≈ 75–150 MB on
 * disk and keeps us well under a single-user quota blowout.
 */
const MAX_TILES_PER_PACK = 5000;

/**
 * Cheap upper-bound estimate of tiles covered by a bbox across a zoom range.
 * Formula: at zoom `z`, the world is 2^z tiles wide on each axis, so the
 * tile count for a bbox is `ceil(lngDelta/360 * 2^z) * ceil(latDelta/180 * 2^z)`.
 * Summed across `minZoom..maxZoom` this slightly over-counts (Mercator
 * distortion near the poles) but never under-counts, which is what we want
 * for a gate.
 */
export function estimateTileCount(
  bbox: [number, number, number, number],
  minZoom: number,
  maxZoom: number,
): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const lngDelta = Math.abs(maxLng - minLng);
  const latDelta = Math.abs(maxLat - minLat);
  let total = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const tilesX = Math.max(1, Math.ceil((lngDelta / 360) * 2 ** z));
    const tilesY = Math.max(1, Math.ceil((latDelta / 180) * 2 ** z));
    total += tilesX * tilesY;
  }
  return total;
}

export interface OfflinePackMeta {
  tripId: string;
  downloadedAt: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  /** Bytes reported by Mapbox when the pack finishes. */
  sizeBytes?: number;
  styleURL: string;
}

interface Registry {
  packs: Record<string, OfflinePackMeta>;
}

function readRegistry(): Registry {
  const raw = getOfflineStore()?.getString(REGISTRY_KEY);
  if (!raw) return { packs: {} };
  try {
    return JSON.parse(raw) as Registry;
  } catch {
    return { packs: {} };
  }
}

function writeRegistry(reg: Registry): void {
  getOfflineStore()?.set(REGISTRY_KEY, JSON.stringify(reg));
}

export function getOfflineMeta(tripId: string): OfflinePackMeta | null {
  return readRegistry().packs[tripId] ?? null;
}

export function listOfflineTrips(): OfflinePackMeta[] {
  return Object.values(readRegistry().packs).sort((a, b) =>
    b.downloadedAt.localeCompare(a.downloadedAt),
  );
}

/**
 * Projects a TripDetail payload down to the fields the offline screen actually
 * renders. Drops per-user UUIDs (participant.id, bikeId) so a leaked MMKV blob
 * can't be re-keyed against the server. Everything else on `trip` (title,
 * dates, waypoints, organiser) flows through untouched.
 */
function stripPii<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.participants)) return payload;

  const sanitized = {
    ...p,
    participants: p.participants.map((raw) => {
      const part = raw as Record<string, unknown>;
      return {
        displayName: part.displayName ?? null,
        publicUsername: part.publicUsername ?? null,
        avatarUrl: part.avatarUrl ?? null,
        role: part.role ?? null,
        status: part.status ?? null,
      };
    }),
  };
  return sanitized as T;
}

/** Cache the rendered trip payload so `trip-detail` can hydrate offline. */
export function cacheTripPayload<T>(tripId: string, payload: T): void {
  getOfflineStore()?.set(PAYLOAD_KEY(tripId), JSON.stringify(stripPii(payload)));
}

export function readCachedTripPayload<T>(tripId: string): T | null {
  const raw = getOfflineStore()?.getString(PAYLOAD_KEY(tripId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface OfflineProgress {
  percentage: number; // 0..100
  completedTileCount: number;
  requiredTileCount: number;
  completedResourceSize: number;
}

export interface DownloadParams {
  tripId: string;
  bbox: [number, number, number, number];
  styleURL: string;
  onProgress?: (p: OfflineProgress) => void;
}

/**
 * Mapbox RN SDK's public API for pack size is the async `bytes()` method, but
 * some versions still expose `_size` synchronously. Prefer the sync field when
 * it's there; callers that need certainty should fall back to `bytes()`.
 */
function getPackSizeBytes(pack: unknown): number | undefined {
  const p = pack as { bytes?: () => Promise<number>; _size?: number };
  if (typeof p._size === 'number') return p._size;
  return undefined;
}

/**
 * Start (or resume) an offline download.
 * Resolves when the pack is complete. Rejects if Mapbox surfaces an error.
 */
export async function downloadOfflinePack(params: DownloadParams): Promise<OfflinePackMeta> {
  const { tripId, bbox, styleURL, onProgress } = params;
  const name = PACK_NAME(tripId);

  const estimated = estimateTileCount(bbox, OFFLINE_MIN_ZOOM, OFFLINE_MAX_ZOOM);
  if (estimated > MAX_TILES_PER_PACK) {
    throw new Error(
      `Offline pack too large (~${estimated.toLocaleString()} tiles). ` +
        `Try a shorter trip or fewer days — the limit is ${MAX_TILES_PER_PACK.toLocaleString()} tiles.`,
    );
  }

  // If a pack with that name already exists, wipe it — we want to re-download
  // with the current bbox/style.
  try {
    await MapboxGL.offlineManager.deletePack(name);
  } catch {
    /* no-op — pack probably didn't exist */
  }

  await new Promise<void>((resolve, reject) => {
    // Mapbox fires progress 50-300 times per pack; only forward whole-percent
    // transitions (plus the terminal Complete tick) so the progress UI doesn't
    // re-render on every native callback.
    let lastReportedPct = -1;

    MapboxGL.offlineManager
      .createPack(
        {
          name,
          styleURL,
          bounds: [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          minZoom: OFFLINE_MIN_ZOOM,
          maxZoom: OFFLINE_MAX_ZOOM,
        },
        (_pack, status) => {
          const s = status as {
            percentage?: number;
            completedTileCount?: number;
            requiredTileCount?: number;
            completedResourceSize?: number;
          };
          const pct = Math.floor(s.percentage ?? 0);
          const isComplete = status.state === MapboxGL.OfflinePackDownloadState.Complete;

          if (onProgress && (isComplete || pct - lastReportedPct >= 1)) {
            lastReportedPct = pct;
            onProgress({
              percentage: s.percentage ?? 0,
              completedTileCount: s.completedTileCount ?? 0,
              requiredTileCount: s.requiredTileCount ?? 0,
              completedResourceSize: s.completedResourceSize ?? 0,
            });
          }

          if (isComplete) {
            resolve();
          }
        },
        (_pack, err) => reject(err),
      )
      .catch(reject);
  });

  const packs = await MapboxGL.offlineManager.getPacks();
  const finished = packs.find((p) => p.name === name);
  const sizeBytes = finished ? getPackSizeBytes(finished) : undefined;

  const meta: OfflinePackMeta = {
    tripId,
    bbox,
    styleURL,
    downloadedAt: new Date().toISOString(),
    sizeBytes,
  };
  const reg = readRegistry();
  reg.packs[tripId] = meta;
  writeRegistry(reg);
  return meta;
}

export async function removeOfflinePack(tripId: string): Promise<void> {
  const name = PACK_NAME(tripId);
  try {
    await MapboxGL.offlineManager.deletePack(name);
  } catch {
    /* no-op */
  }
  const reg = readRegistry();
  delete reg.packs[tripId];
  writeRegistry(reg);
  getOfflineStore()?.remove(PAYLOAD_KEY(tripId));
}

/**
 * Build a sensible bbox from a list of lng/lat points with a small padding.
 * Default pad is ~2 km (0.02°) — enough to show the first turn off-route
 * without quadrupling tile count, which 0.05°+ did on long trips.
 */
export function bboxFromPoints(
  points: Array<{ lat: number; lng: number }>,
  paddingDeg = 0.02,
): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  return [minLng - paddingDeg, minLat - paddingDeg, maxLng + paddingDeg, maxLat + paddingDeg];
}

export function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes < 1024) return `${bytes ?? 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
