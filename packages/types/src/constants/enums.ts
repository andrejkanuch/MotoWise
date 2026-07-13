export const UserRole = { USER: 'user', ADMIN: 'admin' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ArticleDifficulty = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;
export type ArticleDifficulty = (typeof ArticleDifficulty)[keyof typeof ArticleDifficulty];

export const ArticleCategory = {
  ENGINE: 'engine',
  BRAKES: 'brakes',
  ELECTRICAL: 'electrical',
  SUSPENSION: 'suspension',
  DRIVETRAIN: 'drivetrain',
  TIRES: 'tires',
  FUEL: 'fuel',
  GENERAL: 'general',
} as const;
export type ArticleCategory = (typeof ArticleCategory)[keyof typeof ArticleCategory];

export const DiagnosticSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type DiagnosticSeverity = (typeof DiagnosticSeverity)[keyof typeof DiagnosticSeverity];

export const FlagStatus = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const;
export type FlagStatus = (typeof FlagStatus)[keyof typeof FlagStatus];

export const MotorcycleType = {
  CRUISER: 'cruiser',
  SPORTBIKE: 'sportbike',
  STANDARD: 'standard',
  TOURING: 'touring',
  DUAL_SPORT: 'dual_sport',
  DIRT_BIKE: 'dirt_bike',
  SCOOTER: 'scooter',
  OTHER: 'other',
} as const;
export type MotorcycleType = (typeof MotorcycleType)[keyof typeof MotorcycleType];

export const ExperienceLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;
export type ExperienceLevel = (typeof ExperienceLevel)[keyof typeof ExperienceLevel];

export const MaintenanceTaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
} as const;
export type MaintenanceTaskStatus =
  (typeof MaintenanceTaskStatus)[keyof typeof MaintenanceTaskStatus];

export const MaintenancePriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type MaintenancePriority = (typeof MaintenancePriority)[keyof typeof MaintenancePriority];

export const RidingFrequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  SEASONALLY: 'seasonally',
} as const;
export type RidingFrequency = (typeof RidingFrequency)[keyof typeof RidingFrequency];

export const MaintenanceStyle = {
  DIY: 'diy',
  SOMETIMES: 'sometimes',
  MECHANIC: 'mechanic',
} as const;
export type MaintenanceStyle = (typeof MaintenanceStyle)[keyof typeof MaintenanceStyle];

export const LearningFormat = {
  QUICK_TIPS: 'quick_tips',
  DEEP_DIVES: 'deep_dives',
  VIDEO_WALKTHROUGHS: 'video_walkthroughs',
  HANDS_ON_QUIZZES: 'hands_on_quizzes',
} as const;
export type LearningFormat = (typeof LearningFormat)[keyof typeof LearningFormat];

export const SubscriptionTier = { FREE: 'free', PRO: 'pro' } as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export const RidingGoal = {
  // V1 goals (kept for backward compatibility)
  LEARN_MAINTENANCE: 'learn_maintenance',
  IMPROVE_RIDING: 'improve_riding',
  TRACK_MAINTENANCE: 'track_maintenance',
  SAVE_MONEY: 'save_money',
  FIND_COMMUNITY: 'find_community',
  SAFETY: 'safety',
  SAVE_ON_MAINTENANCE: 'save_on_maintenance',
  TRACK_BIKE_HEALTH: 'track_bike_health',
  // V2 goals (onboarding redesign)
  TRACK_RIDES: 'track_rides',
  MANAGE_EXPENSES: 'manage_expenses',
  DISCOVER_ROUTES: 'discover_routes',
  MAINTAIN_BIKE: 'maintain_bike',
  JUST_EXPLORING: 'just_exploring',
} as const;
export type RidingGoal = (typeof RidingGoal)[keyof typeof RidingGoal];

export const InsightType = {
  MAINTENANCE: 'maintenance',
  LEARNING: 'learning',
  COMMUNITY: 'community',
} as const;
export type InsightType = (typeof InsightType)[keyof typeof InsightType];

export const AnnualRepairSpend = {
  UNDER_200: 'under_200',
  SPEND_200_500: '200_500',
  SPEND_500_1000: '500_1000',
  SPEND_1000_PLUS: '1000_plus',
  UNSURE: 'unsure',
} as const;
export type AnnualRepairSpend = (typeof AnnualRepairSpend)[keyof typeof AnnualRepairSpend];

export const LastServiceDate = {
  UNDER_1MO: 'under_1mo',
  BETWEEN_1_3MO: '1_3mo',
  BETWEEN_3_6MO: '3_6mo',
  OVER_6MO: '6mo_plus',
  UNSURE: 'unsure',
} as const;
export type LastServiceDate = (typeof LastServiceDate)[keyof typeof LastServiceDate];

export const ReminderChannel = {
  PUSH: 'push',
  EMAIL: 'email',
  BOTH: 'both',
} as const;
export type ReminderChannel = (typeof ReminderChannel)[keyof typeof ReminderChannel];

export const MileageUnit = {
  MI: 'mi',
  KM: 'km',
} as const;
export type MileageUnit = (typeof MileageUnit)[keyof typeof MileageUnit];

export const MeasurementSystem = {
  METRIC: 'metric',
  IMPERIAL: 'imperial',
} as const;
export type MeasurementSystem = (typeof MeasurementSystem)[keyof typeof MeasurementSystem];

export const Currency = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  CAD: 'CAD',
  AUD: 'AUD',
  CHF: 'CHF',
  INR: 'INR',
  BRL: 'BRL',
  MXN: 'MXN',
  SEK: 'SEK',
  NOK: 'NOK',
  DKK: 'DKK',
  PLN: 'PLN',
  TRY: 'TRY',
  RSD: 'RSD',
  CZK: 'CZK',
  HUF: 'HUF',
  RON: 'RON',
  BGN: 'BGN',
  COP: 'COP',
  ARS: 'ARS',
  CLP: 'CLP',
  PEN: 'PEN',
  KES: 'KES',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

/** Static symbol map — formatToParts() is broken on iOS Hermes */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  JPY: '\u00A5',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  INR: '\u20B9',
  BRL: 'R$',
  MXN: 'MX$',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'z\u0142',
  TRY: '\u20BA',
  RSD: 'din.',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  BGN: 'лв',
  COP: '$',
  ARS: '$',
  CLP: '$',
  PEN: 'S/.',
  KES: 'KSh',
};

/**
 * CANCELLED: User opted out but period hasn't ended (may still have access).
 * EXPIRED: Billing period ended without renewal (no access).
 */
export const SubscriptionStatus = {
  FREE: 'free',
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const MaintenanceTaskSource = {
  USER: 'user',
  OEM: 'oem',
  IMPORTED: 'imported',
} as const;
export type MaintenanceTaskSource =
  (typeof MaintenanceTaskSource)[keyof typeof MaintenanceTaskSource];

export const URGENCY_VALUES = ['stranded', 'soon', 'preventive'] as const;
export type Urgency = (typeof URGENCY_VALUES)[number];

export const AffiliatePartner = {
  REVZILLA: 'revzilla',
  AMAZON: 'amazon',
  ROCKY_MOUNTAIN: 'rocky_mountain',
} as const;
export type AffiliatePartner = (typeof AffiliatePartner)[keyof typeof AffiliatePartner];

export const HealthReportStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type HealthReportStatus = (typeof HealthReportStatus)[keyof typeof HealthReportStatus];

export const SummaryGenerationStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type SummaryGenerationStatus =
  (typeof SummaryGenerationStatus)[keyof typeof SummaryGenerationStatus];

export const SponsorshipStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DEACTIVATED: 'deactivated',
  EXPIRED: 'expired',
} as const;
export type SponsorshipStatus = (typeof SponsorshipStatus)[keyof typeof SponsorshipStatus];

export const SponsorshipPlacementType = {
  BANNER: 'banner',
  CARD: 'card',
  PIN: 'pin',
} as const;
export type SponsorshipPlacementType =
  (typeof SponsorshipPlacementType)[keyof typeof SponsorshipPlacementType];

export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'de',
  'fr',
  'it',
  'pt-BR',
  'ja',
  'hi',
  'th',
  'id',
  'tr',
  'pl',
  'sk',
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Maintenance data-sourcing pilot (U1) ---------------------------------------

// A bike's drivetrain/trim variant. NULL on a schedule/spec row = applies to all variants.
export const MotorcycleVariant = {
  DCT: 'DCT',
  MT: 'MT',
} as const;
export type MotorcycleVariant = (typeof MotorcycleVariant)[keyof typeof MotorcycleVariant];

// Point-value spec categories stored in motorcycle_specs.
export const MaintenanceSpecType = {
  TORQUE: 'torque',
  VALVE_CLEARANCE: 'valve_clearance',
  CAPACITY: 'capacity',
  PRESSURE: 'pressure',
  PLUG_GAP: 'plug_gap',
} as const;
export type MaintenanceSpecType = (typeof MaintenanceSpecType)[keyof typeof MaintenanceSpecType];

// Provenance document type for maintenance_data_sources.
export const MaintenanceSourceType = {
  OWNER_MANUAL: 'owner_manual',
  SERVICE_MANUAL: 'service_manual',
  COMMUNITY: 'community',
} as const;
export type MaintenanceSourceType =
  (typeof MaintenanceSourceType)[keyof typeof MaintenanceSourceType];

// Server-side safety-critical classification. A task/spec name is safety-critical when its
// lowercased text contains one of these terms. NEVER set by the LLM (plan KTD 8) — the
// extraction path computes is_safety_critical from this list, not from model output.
export const SAFETY_CRITICAL_ALLOWLIST = [
  'valve clearance',
  'brake fluid',
  'clutch fluid',
  'engine oil',
  'tire pressure',
] as const;
export type SafetyCriticalTerm = (typeof SAFETY_CRITICAL_ALLOWLIST)[number];

/** True when a task/spec name maps to a safety-critical value per the allowlist. */
export function isSafetyCriticalName(name: string): boolean {
  const lower = name.toLowerCase();
  return SAFETY_CRITICAL_ALLOWLIST.some((term) => lower.includes(term));
}

// Blog CMS (extensible content platform) ------------------------------------
// Content type discriminator on blog_posts. Adding a type = extend this list +
// the per-type table + the typeData Zod union (see validators/blog-content-types.ts).
export const BlogPostType = {
  GUIDE: 'guide',
  MAINTENANCE: 'maintenance',
  TRIP: 'trip',
  GEAR: 'gear',
} as const;
export type BlogPostType = (typeof BlogPostType)[keyof typeof BlogPostType];

// Editorial workflow state. Scheduled posts are flipped to published by pg_cron.
export const BlogPostStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
} as const;
export type BlogPostStatus = (typeof BlogPostStatus)[keyof typeof BlogPostStatus];

// Locales the web blog is authored/imported in (subset of SUPPORTED_LOCALES).
// The 8-locale site routing keeps its en-fallback for the rest (plan KTD10).
export const BLOG_LOCALES = ['en', 'es', 'de', 'fr', 'it'] as const;
export type BlogLocale = (typeof BLOG_LOCALES)[number];

// Guide difficulty (per-type field on blog_post_guide).
export const BlogGuideDifficulty = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
} as const;
export type BlogGuideDifficulty = (typeof BlogGuideDifficulty)[keyof typeof BlogGuideDifficulty];
