import { Directory, File, Paths } from 'expo-file-system';
import type { View } from 'react-native';
import { PixelRatio } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { CardVariant } from './share-card-types';

const EXPORT_W = 1080;
const EXPORT_H = 1920;

/** Compute card dimensions in points that produce exactly 1080x1920 at the device pixel ratio */
export function getExportCardDimensions() {
  const scale = PixelRatio.get();
  return {
    width: EXPORT_W / scale,
    height: EXPORT_H / scale,
  };
}

/** Sanitize rideId for safe use in file paths */
function safeCacheId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '');
}

function cacheFileName(rideId: string, variant: CardVariant, updatedAt?: string): string {
  const ts = updatedAt ?? 'unknown';
  return `share-card-${safeCacheId(rideId)}-${variant}-${ts}.png`;
}

/** Render a card view ref to a 1080x1920 PNG and cache it */
export async function renderShareCard(
  viewRef: React.RefObject<View | null>,
  rideId: string,
  variant: CardVariant,
  updatedAt?: string,
): Promise<string> {
  const cacheDir = new Directory(Paths.cache, 'share-cards');
  if (!cacheDir.exists) {
    cacheDir.create();
  }

  const fileName = cacheFileName(rideId, variant, updatedAt);
  const cachedFile = new File(cacheDir, fileName);

  if (cachedFile.exists) {
    return cachedFile.uri;
  }

  const tmpUri = await captureRef(viewRef, {
    format: 'png',
    quality: 1.0,
    width: EXPORT_W,
    height: EXPORT_H,
    result: 'tmpfile',
  });

  const tmpFile = new File(tmpUri);
  tmpFile.move(cachedFile);

  return cachedFile.uri;
}
