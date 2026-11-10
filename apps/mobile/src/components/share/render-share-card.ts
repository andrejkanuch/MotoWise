import { Directory, File, Paths } from 'expo-file-system';
import type { View } from 'react-native';
import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { CardVariant } from './share-card-types';

export interface ExportPixels {
  width: number;
  height: number;
}

/** A ride share card: a 1080x1920 story image. */
const RIDE_EXPORT: ExportPixels = { width: 1080, height: 1920 };

/** Card dimensions in points that produce exactly `pixels` at the device pixel ratio. */
export function getExportCardDimensions(pixels: ExportPixels = RIDE_EXPORT) {
  const scale = PixelRatio.get();
  return {
    width: pixels.width / scale,
    height: pixels.height / scale,
  };
}

/** Sanitize an id for safe use in file paths */
function safeCacheId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '');
}

function rideCacheKey(rideId: string, variant: CardVariant, updatedAt?: string): string {
  return `card-${rideId}-${variant}-${updatedAt ?? 'unknown'}`;
}

/**
 * Capture a view to a PNG of exactly `pixels` and cache it under `cacheKey`.
 * A key seen before returns the cached file without capturing again, so the
 * key must change whenever the image would.
 */
export async function captureShareImage(
  viewRef: React.RefObject<View | null>,
  cacheKey: string,
  pixels: ExportPixels,
): Promise<string> {
  const cacheDir = new Directory(Paths.cache, 'share-cards');
  if (!cacheDir.exists) {
    cacheDir.create();
  }

  const cachedFile = new File(cacheDir, `share-${safeCacheId(cacheKey)}.png`);
  if (cachedFile.exists) {
    return cachedFile.uri;
  }

  const tmpUri = await captureRef(viewRef, {
    format: 'png',
    quality: 1.0,
    width: pixels.width,
    height: pixels.height,
    result: 'tmpfile',
  });

  const tmpFile = new File(tmpUri);
  tmpFile.move(cachedFile);

  return cachedFile.uri;
}

/** Render a ride card view ref to a 1080x1920 PNG and cache it */
export function renderShareCard(
  viewRef: React.RefObject<View | null>,
  rideId: string,
  variant: CardVariant,
  updatedAt?: string,
): Promise<string> {
  return captureShareImage(viewRef, rideCacheKey(rideId, variant, updatedAt), RIDE_EXPORT);
}
