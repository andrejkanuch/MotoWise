import type { ImageSourcePropType } from 'react-native';

/**
 * Per-make bike photography for the Reveal dossier + Commitment medallion.
 * Covers the top 10 makes by registered bike count (see DB make distribution);
 * everything else falls back to a neutral default. Keys are normalized make
 * names (lowercase, spaces→dashes).
 */
const BIKE_IMAGES: Record<string, ImageSourcePropType> = {
  honda: require('../assets/images/bikes/honda.jpg'),
  bmw: require('../assets/images/bikes/bmw.jpg'),
  kawasaki: require('../assets/images/bikes/kawasaki.jpg'),
  yamaha: require('../assets/images/bikes/yamaha.jpg'),
  suzuki: require('../assets/images/bikes/suzuki.jpg'),
  ktm: require('../assets/images/bikes/ktm.jpg'),
  'harley-davidson': require('../assets/images/bikes/harley-davidson.jpg'),
  triumph: require('../assets/images/bikes/triumph.jpg'),
  ducati: require('../assets/images/bikes/ducati.jpg'),
  'royal-enfield': require('../assets/images/bikes/royal-enfield.jpg'),
};

const DEFAULT_BIKE_IMAGE: ImageSourcePropType = require('../assets/images/bikes/default.jpg');

/** Resolve a bike photo for a make, falling back to the neutral default. */
export function getBikeImage(make?: string | null): ImageSourcePropType {
  if (!make) return DEFAULT_BIKE_IMAGE;
  const key = make.trim().toLowerCase().replace(/\s+/g, '-');
  return BIKE_IMAGES[key] ?? DEFAULT_BIKE_IMAGE;
}
