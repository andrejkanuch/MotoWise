export const MAX_MOTORCYCLE_YEAR = new Date().getFullYear() + 2;
export const MIN_MOTORCYCLE_YEAR = 1900;

export const FREE_TIER_LIMITS = {
  MAX_BIKES: 1,
  MAX_MAINTENANCE_TASKS_PER_BIKE: 5,
  MAX_AI_DIAGNOSTICS_PER_MONTH: 3,
  MAX_ARTICLES_PER_WEEK: 3,
  MAX_MILEAGE: 999999,
} as const;

export const PRO_FEATURES = {
  UNLIMITED_BIKES: 'unlimited_bikes',
  UNLIMITED_ARTICLES: 'unlimited_articles',
  FULL_AI_DIAGNOSTICS: 'full_ai_diagnostics',
  MAINTENANCE_REMINDERS: 'maintenance_reminders',
  PDF_EXPORT: 'pdf_export',
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
