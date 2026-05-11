export const MAX_MOTORCYCLE_YEAR = new Date().getFullYear() + 2;
export const MIN_MOTORCYCLE_YEAR = 1900;

export const FREE_TIER_LIMITS = {
  MAX_BIKES: 2,
  MAX_AI_DIAGNOSTICS_PER_MONTH: 1,
  MAX_ARTICLES_PER_MONTH: 2,
  MAX_MILEAGE: 999999,
} as const;

export const GPX_EXPORT_LIMITS = {
  /** Free-tier users: 1 GPX export per month (taste-then-convert model) */
  FREE_MONTHLY_EXPORTS: 1,
  /** Pro-tier users: unlimited (use -1 sentinel) */
  PRO_MONTHLY_EXPORTS: -1,
} as const;

export const AI_FEATURE_LIMITS = {
  /** Free-tier users: trip assistant questions allowed per month */
  FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH: 3,
  /** Free-tier users: AI ride summaries generated per month */
  FREE_RIDE_SUMMARIES_PER_MONTH: 2,
} as const;

export const PRO_FEATURES = {
  UNLIMITED_BIKES: 'unlimited_bikes',
  UNLIMITED_ARTICLES: 'unlimited_articles',
  FULL_AI_DIAGNOSTICS: 'full_ai_diagnostics',
  MAINTENANCE_REMINDERS: 'maintenance_reminders',
  GPX_EXPORT: 'gpx_export',
  TRIP_ASSISTANT: 'trip_assistant',
  RIDE_SUMMARIES: 'ride_summaries',
  OFFLINE_TRIPS: 'offline_trips',
} as const;

export type ProFeature = (typeof PRO_FEATURES)[keyof typeof PRO_FEATURES];

/** Maximum decoded image size for diagnostic uploads (5 MB) */
export const MAX_DIAGNOSTIC_IMAGE_BYTES = 5 * 1024 * 1024;

/** Maximum base64 string length for diagnostic uploads (~6.7 MB base64 = ~5 MB decoded) */
export const MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH = Math.ceil(MAX_DIAGNOSTIC_IMAGE_BYTES / 3) * 4;

export const AI_BUDGET_LIMITS = {
  /** Maximum AI generations per day for free-tier users */
  FREE_DAILY_GENERATIONS: 50,
  /** Maximum AI generations per day for Pro-tier users */
  PRO_DAILY_GENERATIONS: 200,
  /** Global daily spend cap in cents before circuit breaker trips ($50) */
  GLOBAL_DAILY_SPEND_CAP_CENTS: 5000,
} as const;
