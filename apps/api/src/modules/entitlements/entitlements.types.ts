export const TIERS = { ANONYMOUS: 'anonymous', FREE: 'free', PRO: 'pro' } as const;
export type Tier = (typeof TIERS)[keyof typeof TIERS];

export const FEATURES = {
  READ_ALL_REVIEWS: 'READ_ALL_REVIEWS',
  WRITE_REVIEW: 'WRITE_REVIEW',
  SAVE_ROUTE: 'SAVE_ROUTE',
  DOWNLOAD_GPX: 'DOWNLOAD_GPX',
  USE_OFFLINE_MAPS: 'USE_OFFLINE_MAPS',
  SEE_FUEL_OVERLAY: 'SEE_FUEL_OVERLAY',
  AD_FREE: 'AD_FREE',
} as const;
export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

// Complete gating matrix — all 3 tiers × all 7 features
export const GATING_MATRIX: Record<Tier, Record<Feature, boolean>> = {
  anonymous: {
    READ_ALL_REVIEWS: false,
    WRITE_REVIEW: false,
    SAVE_ROUTE: false,
    DOWNLOAD_GPX: false,
    USE_OFFLINE_MAPS: false,
    SEE_FUEL_OVERLAY: false,
    AD_FREE: false,
  },
  free: {
    READ_ALL_REVIEWS: true,
    WRITE_REVIEW: true,
    SAVE_ROUTE: true,
    DOWNLOAD_GPX: false,
    USE_OFFLINE_MAPS: false,
    SEE_FUEL_OVERLAY: false,
    AD_FREE: false,
  },
  pro: {
    READ_ALL_REVIEWS: true,
    WRITE_REVIEW: true,
    SAVE_ROUTE: true,
    DOWNLOAD_GPX: true,
    USE_OFFLINE_MAPS: true,
    SEE_FUEL_OVERLAY: true,
    AD_FREE: true,
  },
} as const;
