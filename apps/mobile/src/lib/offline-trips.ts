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
import * as SecureStore from 'expo-secure-store';
import { createMMKV } from 'react-native-mmkv';

const MMKV_KEY_STORE_KEY = 'motovault.offline.mmkv.key.v1';

/**
 * Pulls (or lazily generates) a per-install 32-byte encryption key from
 * expo-secure-store. expo-secure-store v13+ exposes sync getItem/setItem, so
 * we can keep a module-level MMKV handle without forcing every call-site async.
 */
function getOrCreateMmkvKey(): string {
  const existing = SecureStore.getItem(MMKV_KEY_STORE_KEY);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const key = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  SecureStore.setItem(MMKV_KEY_STORE_KEY, key);
  return key;
}

const OFFLINE_STORE = createMMKV({
  id: 'offline-trips-v1',
  encryptionKey: getOrCreateMmkvKey(),
});

const PACK_NAME = (tripId: string) => `trip-${tripId}`;
const REGISTRY_KEY = 'registry';
const PAYLOAD_KEY = (tripId: string) => `payload:${tripId}`;

/** Conservative zoom range — street-level detail without blowing up disk. */
export const OFFLINE_MIN_ZOOM = 8;
export const OFFLINE_MAX_ZOOM = 14;

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
  const raw = OFFLINE_STORE.getString(REGISTRY_KEY);
  if (!raw) return { packs: {} };
  try {
    return JSON.parse(raw) as Registry;
  } catch {
    return { packs: {} };
  }
}

function writeRegistry(reg: Registry): void {
  OFFLINE_STORE.set(REGISTRY_KEY, JSON.stringify(reg));
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
  OFFLINE_STORE.set(PAYLOAD_KEY(tripId), JSON.stringify(stripPii(payload)));
}

export function readCachedTripPayload<T>(tripId: string): T | null {
  const raw = OFFLINE_STORE.getString(PAYLOAD_KEY(tripId));
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
  OFFLINE_STORE.remove(PAYLOAD_KEY(tripId));
}

/** Build a sensible bbox from a list of lng/lat points with a small padding. */
export function bboxFromPoints(
  points: Array<{ lat: number; lng: number }>,
  paddingDeg = 0.05,
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
