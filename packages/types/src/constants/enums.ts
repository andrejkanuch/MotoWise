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

export const SUPPORTED_LOCALES = ['en', 'es', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
