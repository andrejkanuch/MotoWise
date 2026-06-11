import type { ImageSourcePropType } from 'react-native';

/**
 * Per-make bike photography for the Reveal dossier + Commitment medallion.
 * Five flagship makes ship a real photo; everything else falls back to a
 * neutral default. Keys are normalized make names (lowercase, spaces→dashes).
 */
const BIKE_IMAGES: Record<string, ImageSourcePropType> = {
  bmw: require('../assets/images/bikes/bmw.jpg'),
  'harley-davidson': require('../assets/images/bikes/harley-davidson.jpg'),
  ktm: require('../assets/images/bikes/ktm.jpg'),
  ducati: require('../assets/images/bikes/ducati.jpg'),
  triumph: require('../assets/images/bikes/triumph.jpg'),
};

const DEFAULT_BIKE_IMAGE: ImageSourcePropType = require('../assets/images/bikes/default.jpg');

/** Resolve a bike photo for a make, falling back to the neutral default. */
export function getBikeImage(make?: string | null): ImageSourcePropType {
  if (!make) return DEFAULT_BIKE_IMAGE;
  const key = make.trim().toLowerCase().replace(/\s+/g, '-');
  return BIKE_IMAGES[key] ?? DEFAULT_BIKE_IMAGE;
}
