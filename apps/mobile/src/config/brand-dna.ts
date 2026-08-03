import { palette } from '@motovault/design-system';

/**
 * Brand DNA — static metadata for popular motorcycle makes.
 * Service intervals are manufacturer-recommended defaults (public spec data).
 */

export type BikeArchetype = 'sport' | 'adv' | 'cruiser';

export interface BrandInfo {
  /** Visual archetype for silhouette/icon selection */
  type: BikeArchetype;
  /** Short brand tagline */
  tagline: string;
  /** Manufacturer-recommended oil change interval */
  serviceInterval: string;
}

/** Brand colors for the make grid + hero card — matches brand identity */
export const MAKE_COLORS: Record<string, string> = {
  BMW: '#0066B1',
  Honda: '#CC0000',
  Kawasaki: '#6BBE44',
  Yamaha: '#0033A0',
  KTM: '#FF6600',
  'Harley-Davidson': '#F36B21',
  Suzuki: '#003DA5',
  Triumph: '#D4AF37',
  'Royal Enfield': '#8B4513',
  Ducati: '#CC0000',
  Bajaj: '#2E5090',
  Aprilia: '#CC0000',
  CFMoto: '#E63946',
  Husqvarna: '#2A4B7C',
  Beta: '#CC0000',
  Indian: '#8B0000',
};

export const BRAND_DNA: Record<string, BrandInfo> = {
  BMW: {
    type: 'adv',
    tagline: 'Bavarian engineering, every ride.',
    serviceInterval: '10,000 km',
  },
  Honda: {
    type: 'sport',
    tagline: 'Built to outlast the road.',
    serviceInterval: '12,000 km',
  },
  Kawasaki: {
    type: 'sport',
    tagline: 'Let the good times roll.',
    serviceInterval: '12,000 km',
  },
  Yamaha: {
    type: 'sport',
    tagline: 'Engineering joy since 1955.',
    serviceInterval: '10,000 km',
  },
  KTM: {
    type: 'adv',
    tagline: 'Ready to race.',
    serviceInterval: '7,500 km',
  },
  'Harley-Davidson': {
    type: 'cruiser',
    tagline: 'Freedom, distilled into thunder.',
    serviceInterval: '8,000 km',
  },
  Suzuki: {
    type: 'sport',
    tagline: 'Way of life on two wheels.',
    serviceInterval: '12,000 km',
  },
  Triumph: {
    type: 'sport',
    tagline: 'British character, modern craft.',
    serviceInterval: '10,000 km',
  },
  'Royal Enfield': {
    type: 'cruiser',
    tagline: 'Pure motorcycling, refined.',
    serviceInterval: '10,000 km',
  },
  Ducati: {
    type: 'sport',
    tagline: 'Italian passion, distilled.',
    serviceInterval: '12,000 km',
  },
  Bajaj: {
    type: 'sport',
    tagline: 'Distinctly proven, globally ridden.',
    serviceInterval: '10,000 km',
  },
  Aprilia: {
    type: 'sport',
    tagline: 'Italian racing pedigree.',
    serviceInterval: '10,000 km',
  },
  CFMoto: {
    type: 'sport',
    tagline: 'New world, new ride.',
    serviceInterval: '10,000 km',
  },
  Husqvarna: {
    type: 'adv',
    tagline: 'Pioneering since 1903.',
    serviceInterval: '7,500 km',
  },
  Beta: {
    type: 'adv',
    tagline: 'Italian enduro craftsmanship.',
    serviceInterval: '6,000 km',
  },
  Indian: {
    type: 'cruiser',
    tagline: 'An American original since 1901.',
    serviceInterval: '8,000 km',
  },
};

/**
 * Popular makes grid — ordered by real rider count (most → least).
 * These are the 8 makes shown in the quick-pick grid before search.
 */
export const POPULAR_MAKES = [
  'BMW',
  'Honda',
  'Kawasaki',
  'Yamaha',
  'KTM',
  'Suzuki',
  'Triumph',
  'Harley-Davidson',
] as const;

/** Normalize NHTSA uppercase to title case for lookup (e.g. "HARLEY-DAVIDSON" → "Harley-Davidson") */
function normalizeMakeName(raw: string): string {
  return raw
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(raw.includes('-') ? '-' : ' ');
}

/** Lookup helper — returns null for unknown brands */
export function getBrandDna(makeName: string): BrandInfo | null {
  const normalized = normalizeMakeName(makeName);
  return BRAND_DNA[makeName] ?? BRAND_DNA[normalized] ?? null;
}

/** Get brand color — falls back to editorial warm copper */
export function getBrandColor(
  makeName: string,
  fallback: string = palette.editorialDarkWarm,
): string {
  const normalized = normalizeMakeName(makeName);
  return MAKE_COLORS[makeName] ?? MAKE_COLORS[normalized] ?? fallback;
}
