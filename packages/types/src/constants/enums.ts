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
  LEARN_MAINTENANCE: 'learn_maintenance',
  IMPROVE_RIDING: 'improve_riding',
  TRACK_MAINTENANCE: 'track_maintenance',
  SAVE_MONEY: 'save_money',
  FIND_COMMUNITY: 'find_community',
  SAFETY: 'safety',
  SAVE_ON_MAINTENANCE: 'save_on_maintenance',
  TRACK_BIKE_HEALTH: 'track_bike_health',
} as const;
export type RidingGoal = (typeof RidingGoal)[keyof typeof RidingGoal];

export const InsightType = {
  MAINTENANCE: 'maintenance',
  LEARNING: 'learning',
  COMMUNITY: 'community',
} as const;
export type InsightType = (typeof InsightType)[keyof typeof InsightType];

export const SUPPORTED_LOCALES = ['en', 'es', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
