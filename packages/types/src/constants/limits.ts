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
