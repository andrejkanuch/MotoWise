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

export const DiagnosticDifficulty = {
  EASY: 'easy',
  MODERATE: 'moderate',
  HARD: 'hard',
  PROFESSIONAL: 'professional',
} as const;
export type DiagnosticDifficulty = (typeof DiagnosticDifficulty)[keyof typeof DiagnosticDifficulty];

export const FlagStatus = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
} as const;
export type FlagStatus = (typeof FlagStatus)[keyof typeof FlagStatus];
