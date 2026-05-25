import * as FileSystem from 'expo-file-system';
import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { CardVariant } from './share-card-types';

const EXPORT_W = 1080;
const EXPORT_H = 1920;

/** Compute card dimensions in points that produce exactly 1080×1920 at the device pixel ratio */
export function getExportCardDimensions() {
  const scale = PixelRatio.get();
  return {
    width: EXPORT_W / scale,
    height: EXPORT_H / scale,
  };
}

/** Cache directory for share card PNGs */
const SHARE_CACHE_DIR = `${FileSystem.cacheDirectory}share-cards/`;

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(SHARE_CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(SHARE_CACHE_DIR, { intermediates: true });
  }
}

function cacheKey(rideId: string, variant: CardVariant, updatedAt?: string): string {
  const ts = updatedAt ?? 'unknown';
  return `share-card-${rideId}-${variant}-${ts}.png`;
}

/** Check if a cached PNG exists for this ride+variant */
export async function getCachedCardUri(
  rideId: string,
  variant: CardVariant,
  updatedAt?: string,
): Promise<string | null> {
  await ensureCacheDir();
  const path = SHARE_CACHE_DIR + cacheKey(rideId, variant, updatedAt);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

/** Render a card view ref to a 1080×1920 PNG and cache it */
export async function renderShareCard(
  viewRef: React.RefObject<any>,
  rideId: string,
  variant: CardVariant,
  updatedAt?: string,
): Promise<string> {
  // Check cache first
  const cached = await getCachedCardUri(rideId, variant, updatedAt);
  if (cached) return cached;

  await ensureCacheDir();

  const tmpUri = await captureRef(viewRef, {
    format: 'png',
    quality: 1.0,
    width: EXPORT_W,
    height: EXPORT_H,
    result: 'tmpfile',
  });

  // Move to cache directory with stable name
  const destPath = SHARE_CACHE_DIR + cacheKey(rideId, variant, updatedAt);
  await FileSystem.moveAsync({ from: tmpUri, to: destPath });

  return destPath;
}

/** Delete all cached share cards for a specific ride */
export async function clearRideShareCache(rideId: string): Promise<void> {
  await ensureCacheDir();
  const files = await FileSystem.readDirectoryAsync(SHARE_CACHE_DIR);
  const toDelete = files.filter((f) => f.startsWith(`share-card-${rideId}-`));
  await Promise.all(
    toDelete.map((f) => FileSystem.deleteAsync(SHARE_CACHE_DIR + f, { idempotent: true })),
  );
}

/** Evict share card cache entries older than maxAgeDays */
export async function evictStaleShareCache(maxAgeDays = 30): Promise<void> {
  await ensureCacheDir();
  const files = await FileSystem.readDirectoryAsync(SHARE_CACHE_DIR);
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const info = await FileSystem.getInfoAsync(SHARE_CACHE_DIR + file);
    if (info.exists && info.modificationTime && now - info.modificationTime * 1000 > maxAgeMs) {
      await FileSystem.deleteAsync(SHARE_CACHE_DIR + file, { idempotent: true });
    }
  }
}
