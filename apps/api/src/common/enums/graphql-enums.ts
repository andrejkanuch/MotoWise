import type {
  ArticleCategory,
  ArticleDifficulty,
  DiagnosticSeverity,
  FlagStatus,
  MotorcycleType,
  SupportedLocale,
  UserRole,
} from '@motolearn/types';
import { registerEnumType } from '@nestjs/graphql';

// NestJS code-first requires actual TS enums for registerEnumType.
// We create them from our as-const objects in @motolearn/types.
// The string values here MUST stay in sync with packages/types/src/constants/enums.ts.

export enum GqlArticleDifficulty {
  beginner = 'beginner',
  intermediate = 'intermediate',
  advanced = 'advanced',
}

export enum GqlArticleCategory {
  engine = 'engine',
  brakes = 'brakes',
  electrical = 'electrical',
  suspension = 'suspension',
  drivetrain = 'drivetrain',
  tires = 'tires',
  fuel = 'fuel',
  general = 'general',
}

export enum GqlUserRole {
  user = 'user',
  admin = 'admin',
}

export enum GqlFlagStatus {
  pending = 'pending',
  reviewed = 'reviewed',
  resolved = 'resolved',
  dismissed = 'dismissed',
}

export enum GqlDiagnosticSeverity {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

export enum GqlMotorcycleType {
  cruiser = 'cruiser',
  sportbike = 'sportbike',
  standard = 'standard',
  touring = 'touring',
  dual_sport = 'dual_sport',
  dirt_bike = 'dirt_bike',
  scooter = 'scooter',
  other = 'other',
}

registerEnumType(GqlArticleDifficulty, { name: 'ArticleDifficulty' });
registerEnumType(GqlArticleCategory, { name: 'ArticleCategory' });
registerEnumType(GqlUserRole, { name: 'UserRole' });
registerEnumType(GqlFlagStatus, { name: 'FlagStatus' });
registerEnumType(GqlDiagnosticSeverity, { name: 'DiagnosticSeverity' });
export enum GqlMileageUnit {
  mi = 'mi',
  km = 'km',
}

registerEnumType(GqlMotorcycleType, {
  name: 'MotorcycleType',
  description: 'Type/category of motorcycle',
});
registerEnumType(GqlMileageUnit, { name: 'MileageUnit' });

export enum GqlSupportedLocale {
  en = 'en',
  es = 'es',
  de = 'de',
}

registerEnumType(GqlSupportedLocale, { name: 'SupportedLocale' });

// Compile-time sync guards: fail if enums.ts gains a value not in Gql enum
const _localeSync: Record<SupportedLocale, GqlSupportedLocale> = {
  en: GqlSupportedLocale.en,
  es: GqlSupportedLocale.es,
  de: GqlSupportedLocale.de,
};

const _difficultySync: Record<ArticleDifficulty, GqlArticleDifficulty> = {
  beginner: GqlArticleDifficulty.beginner,
  intermediate: GqlArticleDifficulty.intermediate,
  advanced: GqlArticleDifficulty.advanced,
};

const _categorySync: Record<ArticleCategory, GqlArticleCategory> = {
  engine: GqlArticleCategory.engine,
  brakes: GqlArticleCategory.brakes,
  electrical: GqlArticleCategory.electrical,
  suspension: GqlArticleCategory.suspension,
  drivetrain: GqlArticleCategory.drivetrain,
  tires: GqlArticleCategory.tires,
  fuel: GqlArticleCategory.fuel,
  general: GqlArticleCategory.general,
};

const _roleSync: Record<UserRole, GqlUserRole> = {
  user: GqlUserRole.user,
  admin: GqlUserRole.admin,
};

const _flagStatusSync: Record<FlagStatus, GqlFlagStatus> = {
  pending: GqlFlagStatus.pending,
  reviewed: GqlFlagStatus.reviewed,
  resolved: GqlFlagStatus.resolved,
  dismissed: GqlFlagStatus.dismissed,
};

const _severitySync: Record<DiagnosticSeverity, GqlDiagnosticSeverity> = {
  low: GqlDiagnosticSeverity.low,
  medium: GqlDiagnosticSeverity.medium,
  high: GqlDiagnosticSeverity.high,
  critical: GqlDiagnosticSeverity.critical,
};

const _motorcycleTypeSync: Record<MotorcycleType, GqlMotorcycleType> = {
  cruiser: GqlMotorcycleType.cruiser,
  sportbike: GqlMotorcycleType.sportbike,
  standard: GqlMotorcycleType.standard,
  touring: GqlMotorcycleType.touring,
  dual_sport: GqlMotorcycleType.dual_sport,
  dirt_bike: GqlMotorcycleType.dirt_bike,
  scooter: GqlMotorcycleType.scooter,
  other: GqlMotorcycleType.other,
};
