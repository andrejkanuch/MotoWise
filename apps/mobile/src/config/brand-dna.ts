/**
 * Brand DNA — static metadata for popular motorcycle makes.
 * Rider counts and model counts are from production Supabase data (2026-05-12).
 * Service intervals are manufacturer-recommended defaults (public spec data).
 * Only brands with real fleet data are included — no fabricated numbers.
 *
 * Update periodically by running:
 *   SELECT make, COUNT(DISTINCT user_id) as riders, COUNT(DISTINCT model) as models
 *   FROM motorcycles WHERE make IS NOT NULL GROUP BY make ORDER BY riders DESC;
 */

export type BikeArchetype = 'sport' | 'adv' | 'cruiser';

export interface BrandInfo {
  /** Visual archetype for silhouette/icon selection */
  type: BikeArchetype;
  /** Short brand tagline */
  tagline: string;
  /** Manufacturer-recommended oil change interval */
  serviceInterval: string;
  /** Distinct riders in MotoVault fleet (0 = no data) */
  riders: number;
  /** Distinct models tracked in MotoVault fleet (0 = no data) */
  models: number;
  /** Popularity rank (1 = most riders) */
  rank: number;
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

/**
 * Real fleet data from Supabase production (2026-05-12).
 * Service intervals are well-known manufacturer defaults.
 */
export const BRAND_DNA: Record<string, BrandInfo> = {
  BMW: {
    type: 'adv',
    tagline: 'Bavarian engineering, every ride.',
    serviceInterval: '10,000 km',
    riders: 22,
    models: 12,
    rank: 1,
  },
  Honda: {
    type: 'sport',
    tagline: 'Built to outlast the road.',
    serviceInterval: '12,000 km',
    riders: 19,
    models: 17,
    rank: 2,
  },
  Kawasaki: {
    type: 'sport',
    tagline: 'Let the good times roll.',
    serviceInterval: '12,000 km',
    riders: 8,
    models: 8,
    rank: 3,
  },
  Yamaha: {
    type: 'sport',
    tagline: 'Engineering joy since 1955.',
    serviceInterval: '10,000 km',
    riders: 8,
    models: 5,
    rank: 4,
  },
  KTM: {
    type: 'adv',
    tagline: 'Ready to race.',
    serviceInterval: '7,500 km',
    riders: 7,
    models: 5,
    rank: 5,
  },
  'Harley-Davidson': {
    type: 'cruiser',
    tagline: 'Freedom, distilled into thunder.',
    serviceInterval: '8,000 km',
    riders: 6,
    models: 6,
    rank: 6,
  },
  Suzuki: {
    type: 'sport',
    tagline: 'Way of life on two wheels.',
    serviceInterval: '12,000 km',
    riders: 6,
    models: 6,
    rank: 7,
  },
  Triumph: {
    type: 'sport',
    tagline: 'British character, modern craft.',
    serviceInterval: '10,000 km',
    riders: 6,
    models: 5,
    rank: 8,
  },
  'Royal Enfield': {
    type: 'cruiser',
    tagline: 'Pure motorcycling, refined.',
    serviceInterval: '10,000 km',
    riders: 5,
    models: 4,
    rank: 9,
  },
  Ducati: {
    type: 'sport',
    tagline: 'Italian passion, distilled.',
    serviceInterval: '12,000 km',
    riders: 5,
    models: 4,
    rank: 10,
  },
  Bajaj: {
    type: 'sport',
    tagline: 'Distinctly proven, globally ridden.',
    serviceInterval: '10,000 km',
    riders: 3,
    models: 3,
    rank: 11,
  },
  Aprilia: {
    type: 'sport',
    tagline: 'Italian racing pedigree.',
    serviceInterval: '10,000 km',
    riders: 2,
    models: 2,
    rank: 12,
  },
  CFMoto: {
    type: 'sport',
    tagline: 'New world, new ride.',
    serviceInterval: '10,000 km',
    riders: 2,
    models: 2,
    rank: 13,
  },
  Husqvarna: {
    type: 'adv',
    tagline: 'Pioneering since 1903.',
    serviceInterval: '7,500 km',
    riders: 2,
    models: 2,
    rank: 14,
  },
  Beta: {
    type: 'adv',
    tagline: 'Italian enduro craftsmanship.',
    serviceInterval: '6,000 km',
    riders: 1,
    models: 1,
    rank: 15,
  },
  Indian: {
    type: 'cruiser',
    tagline: 'An American original since 1901.',
    serviceInterval: '8,000 km',
    riders: 1,
    models: 1,
    rank: 16,
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

/** Lookup helper — returns null for unknown brands */
export function getBrandDna(makeName: string): BrandInfo | null {
  // Normalize NHTSA uppercase to title case for lookup
  const normalized = makeName
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(makeName.includes('-') ? '-' : ' ');

  // Try exact match first, then normalized
  return BRAND_DNA[makeName] ?? BRAND_DNA[normalized] ?? null;
}

/** Get brand color — falls back to warm accent */
export function getBrandColor(makeName: string, fallback = '#D4884A'): string {
  const normalized = makeName
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(makeName.includes('-') ? '-' : ' ');

  return MAKE_COLORS[makeName] ?? MAKE_COLORS[normalized] ?? fallback;
}
