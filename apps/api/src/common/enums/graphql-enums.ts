import type {
  AffiliatePartner,
  ArticleCategory,
  ArticleDifficulty,
  DiagnosticSeverity,
  FlagStatus,
  HealthReportStatus,
  InsightType,
  LearningFormat,
  MaintenancePriority,
  MaintenanceStyle,
  MaintenanceTaskSource,
  MaintenanceTaskStatus,
  MotorcycleType,
  RideStatus,
  RidingFrequency,
  RidingGoal,
  SponsorshipPlacementType,
  SponsorshipStatus,
  SubscriptionTier,
  SummaryGenerationStatus,
  SupportedLocale,
  Urgency,
  UserRole,
} from '@motovault/types';
import { registerEnumType } from '@nestjs/graphql';

// NestJS code-first requires actual TS enums for registerEnumType.
// We create them from our as-const objects in @motovault/types.
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
  fr = 'fr',
  it = 'it',
  pt_BR = 'pt-BR',
  ja = 'ja',
  hi = 'hi',
  th = 'th',
  id = 'id',
  tr = 'tr',
  pl = 'pl',
  sk = 'sk',
}

registerEnumType(GqlSupportedLocale, { name: 'SupportedLocale' });

// Compile-time sync guards: fail if enums.ts gains a value not in Gql enum
const _localeSync: Record<SupportedLocale, GqlSupportedLocale> = {
  en: GqlSupportedLocale.en,
  es: GqlSupportedLocale.es,
  de: GqlSupportedLocale.de,
  fr: GqlSupportedLocale.fr,
  it: GqlSupportedLocale.it,
  'pt-BR': GqlSupportedLocale.pt_BR,
  ja: GqlSupportedLocale.ja,
  hi: GqlSupportedLocale.hi,
  th: GqlSupportedLocale.th,
  id: GqlSupportedLocale.id,
  tr: GqlSupportedLocale.tr,
  pl: GqlSupportedLocale.pl,
  sk: GqlSupportedLocale.sk,
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

export enum GqlMaintenanceTaskStatus {
  pending = 'pending',
  in_progress = 'in_progress',
  completed = 'completed',
  skipped = 'skipped',
}

export enum GqlMaintenancePriority {
  low = 'low',
  medium = 'medium',
  high = 'high',
  critical = 'critical',
}

registerEnumType(GqlMaintenanceTaskStatus, { name: 'MaintenanceTaskStatus' });
registerEnumType(GqlMaintenancePriority, { name: 'MaintenancePriority' });

const _taskStatusSync: Record<MaintenanceTaskStatus, GqlMaintenanceTaskStatus> = {
  pending: GqlMaintenanceTaskStatus.pending,
  in_progress: GqlMaintenanceTaskStatus.in_progress,
  completed: GqlMaintenanceTaskStatus.completed,
  skipped: GqlMaintenanceTaskStatus.skipped,
};

const _prioritySync: Record<MaintenancePriority, GqlMaintenancePriority> = {
  low: GqlMaintenancePriority.low,
  medium: GqlMaintenancePriority.medium,
  high: GqlMaintenancePriority.high,
  critical: GqlMaintenancePriority.critical,
};

export enum GqlRidingFrequency {
  daily = 'daily',
  weekly = 'weekly',
  monthly = 'monthly',
  seasonally = 'seasonally',
}

export enum GqlMaintenanceStyle {
  diy = 'diy',
  sometimes = 'sometimes',
  mechanic = 'mechanic',
}

export enum GqlLearningFormat {
  quick_tips = 'quick_tips',
  deep_dives = 'deep_dives',
  video_walkthroughs = 'video_walkthroughs',
  hands_on_quizzes = 'hands_on_quizzes',
}

export enum GqlSubscriptionTier {
  free = 'free',
  pro = 'pro',
}

export enum GqlRidingGoal {
  learn_maintenance = 'learn_maintenance',
  improve_riding = 'improve_riding',
  track_maintenance = 'track_maintenance',
  save_money = 'save_money',
  find_community = 'find_community',
  safety = 'safety',
  save_on_maintenance = 'save_on_maintenance',
  track_bike_health = 'track_bike_health',
  // V2 onboarding goals
  track_rides = 'track_rides',
  manage_expenses = 'manage_expenses',
  discover_routes = 'discover_routes',
  maintain_bike = 'maintain_bike',
  just_exploring = 'just_exploring',
}

export enum GqlInsightType {
  maintenance = 'maintenance',
  learning = 'learning',
  community = 'community',
}

registerEnumType(GqlRidingFrequency, { name: 'RidingFrequency' });
registerEnumType(GqlMaintenanceStyle, { name: 'MaintenanceStyle' });
registerEnumType(GqlLearningFormat, { name: 'LearningFormat' });
registerEnumType(GqlSubscriptionTier, { name: 'SubscriptionTier' });
registerEnumType(GqlRidingGoal, { name: 'RidingGoal' });
registerEnumType(GqlInsightType, { name: 'InsightType' });

const _ridingFrequencySync: Record<RidingFrequency, GqlRidingFrequency> = {
  daily: GqlRidingFrequency.daily,
  weekly: GqlRidingFrequency.weekly,
  monthly: GqlRidingFrequency.monthly,
  seasonally: GqlRidingFrequency.seasonally,
};

const _maintenanceStyleSync: Record<MaintenanceStyle, GqlMaintenanceStyle> = {
  diy: GqlMaintenanceStyle.diy,
  sometimes: GqlMaintenanceStyle.sometimes,
  mechanic: GqlMaintenanceStyle.mechanic,
};

const _learningFormatSync: Record<LearningFormat, GqlLearningFormat> = {
  quick_tips: GqlLearningFormat.quick_tips,
  deep_dives: GqlLearningFormat.deep_dives,
  video_walkthroughs: GqlLearningFormat.video_walkthroughs,
  hands_on_quizzes: GqlLearningFormat.hands_on_quizzes,
};

const _subscriptionTierSync: Record<SubscriptionTier, GqlSubscriptionTier> = {
  free: GqlSubscriptionTier.free,
  pro: GqlSubscriptionTier.pro,
};

const _ridingGoalSync: Record<RidingGoal, GqlRidingGoal> = {
  learn_maintenance: GqlRidingGoal.learn_maintenance,
  improve_riding: GqlRidingGoal.improve_riding,
  track_maintenance: GqlRidingGoal.track_maintenance,
  save_money: GqlRidingGoal.save_money,
  find_community: GqlRidingGoal.find_community,
  safety: GqlRidingGoal.safety,
  save_on_maintenance: GqlRidingGoal.save_on_maintenance,
  track_bike_health: GqlRidingGoal.track_bike_health,
  // V2 onboarding goals
  track_rides: GqlRidingGoal.track_rides,
  manage_expenses: GqlRidingGoal.manage_expenses,
  discover_routes: GqlRidingGoal.discover_routes,
  maintain_bike: GqlRidingGoal.maintain_bike,
  just_exploring: GqlRidingGoal.just_exploring,
};

const _insightTypeSync: Record<InsightType, GqlInsightType> = {
  maintenance: GqlInsightType.maintenance,
  learning: GqlInsightType.learning,
  community: GqlInsightType.community,
};

export enum GqlUrgency {
  stranded = 'stranded',
  soon = 'soon',
  preventive = 'preventive',
}

registerEnumType(GqlUrgency, {
  name: 'Urgency',
  description: 'User-reported urgency level for diagnostic requests',
});

const _urgencySync: Record<Urgency, GqlUrgency> = {
  stranded: GqlUrgency.stranded,
  soon: GqlUrgency.soon,
  preventive: GqlUrgency.preventive,
};

export enum GqlMaintenanceTaskSource {
  user = 'user',
  oem = 'oem',
  imported = 'imported',
  receipt_scan = 'receipt_scan',
}

registerEnumType(GqlMaintenanceTaskSource, { name: 'MaintenanceTaskSource' });

const _taskSourceSync: Record<MaintenanceTaskSource, GqlMaintenanceTaskSource> = {
  user: GqlMaintenanceTaskSource.user,
  oem: GqlMaintenanceTaskSource.oem,
  imported: GqlMaintenanceTaskSource.imported,
  receipt_scan: GqlMaintenanceTaskSource.receipt_scan,
};

export enum GqlRideStatus {
  recording = 'recording',
  paused = 'paused',
  completed = 'completed',
}

registerEnumType(GqlRideStatus, {
  name: 'RideStatus',
  description: 'Current status of a ride',
});

const _rideStatusSync: Record<RideStatus, GqlRideStatus> = {
  recording: GqlRideStatus.recording,
  paused: GqlRideStatus.paused,
  completed: GqlRideStatus.completed,
};

export enum GqlAffiliatePartner {
  revzilla = 'revzilla',
  amazon = 'amazon',
  rocky_mountain = 'rocky_mountain',
}

registerEnumType(GqlAffiliatePartner, {
  name: 'AffiliatePartner',
  description: 'Affiliate partner for product recommendations',
});

const _affiliatePartnerSync: Record<AffiliatePartner, GqlAffiliatePartner> = {
  revzilla: GqlAffiliatePartner.revzilla,
  amazon: GqlAffiliatePartner.amazon,
  rocky_mountain: GqlAffiliatePartner.rocky_mountain,
};

export enum GqlHealthReportStatus {
  pending = 'pending',
  completed = 'completed',
  failed = 'failed',
}

registerEnumType(GqlHealthReportStatus, {
  name: 'HealthReportStatus',
  description: 'Status of a bike health report generation',
});

const _healthReportStatusSync: Record<HealthReportStatus, GqlHealthReportStatus> = {
  pending: GqlHealthReportStatus.pending,
  completed: GqlHealthReportStatus.completed,
  failed: GqlHealthReportStatus.failed,
};

export enum GqlGenerationStatus {
  pending = 'pending',
  completed = 'completed',
  failed = 'failed',
}

registerEnumType(GqlGenerationStatus, {
  name: 'GenerationStatus',
  description: 'Status of AI content generation (e.g. ride summaries)',
});

const _generationStatusSync: Record<SummaryGenerationStatus, GqlGenerationStatus> = {
  pending: GqlGenerationStatus.pending,
  completed: GqlGenerationStatus.completed,
  failed: GqlGenerationStatus.failed,
};

export enum GqlSponsorshipStatus {
  active = 'active',
  paused = 'paused',
  deactivated = 'deactivated',
  expired = 'expired',
}

export enum GqlSponsorshipPlacementType {
  banner = 'banner',
  card = 'card',
  pin = 'pin',
}

registerEnumType(GqlSponsorshipStatus, {
  name: 'SponsorshipStatus',
  description: 'Status of a sponsorship slot',
});

registerEnumType(GqlSponsorshipPlacementType, {
  name: 'SponsorshipPlacementType',
  description: 'Visual placement type for a sponsored slot',
});

const _sponsorshipStatusSync: Record<SponsorshipStatus, GqlSponsorshipStatus> = {
  active: GqlSponsorshipStatus.active,
  paused: GqlSponsorshipStatus.paused,
  deactivated: GqlSponsorshipStatus.deactivated,
  expired: GqlSponsorshipStatus.expired,
};

const _sponsorshipPlacementTypeSync: Record<SponsorshipPlacementType, GqlSponsorshipPlacementType> =
  {
    banner: GqlSponsorshipPlacementType.banner,
    card: GqlSponsorshipPlacementType.card,
    pin: GqlSponsorshipPlacementType.pin,
  };
