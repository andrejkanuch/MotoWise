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
registerEnumType(GqlMotorcycleType, {
  name: 'MotorcycleType',
  description: 'Type/category of motorcycle',
});

export enum GqlSupportedLocale {
  en = 'en',
  es = 'es',
  de = 'de',
}

registerEnumType(GqlSupportedLocale, { name: 'SupportedLocale' });
