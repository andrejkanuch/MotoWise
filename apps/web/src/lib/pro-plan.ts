import { AI_FEATURE_LIMITS, FREE_TIER_LIMITS, GPX_EXPORT_LIMITS } from '@motovault/types';

/**
 * What MotoVault Pro actually unlocks — the single source for every web surface
 * that sells it (/pro, the pricing card, the checkout success screen).
 *
 * Every row here is backed by a gate in code; nothing else may be sold as Pro:
 *   - bikes            FREE_TIER_LIMITS.MAX_BIKES          motorcycles.service.ts
 *   - AI diagnostics   MAX_AI_DIAGNOSTICS_PER_MONTH        ai-budget.service.ts
 *   - AI articles      MAX_ARTICLES_PER_MONTH              ai-budget.service.ts
 *   - trip assistant   FREE_TRIP_ASSISTANT_QUESTIONS_…     ai-budget.service.ts
 *   - ride summaries   FREE_RIDE_SUMMARIES_PER_MONTH       ride-summaries.service.ts
 *   - receipt scans    MAX_RECEIPT_SCANS_PER_MONTH         receipt-scan.service.ts
 *   - GPX export       GPX_EXPORT_LIMITS                   trip-gpx-export.service.ts
 *   - offline maps     requirePro('offline_trips')         mobile use-offline-trip.ts
 *
 * Until 2026-10 the web sold "advanced ride analytics", "AI Health Reports",
 * "CSV / PDF export" and "priority support" as Pro. The first two are free for
 * everyone, the last two do not exist. Logging maintenance and expenses is free
 * and must never appear as a Pro benefit.
 */

export const UNLIMITED_LABEL = 'Unlimited';

function perMonth(limit: number): string {
  return `${limit} / month`;
}

export const PRO_FEATURE_KEYS = {
  BIKES: 'bikes',
  AI_DIAGNOSTICS: 'ai_diagnostics',
  AI_EXTRAS: 'ai_extras',
  RECEIPT_SCANS: 'receipt_scans',
  GPX_EXPORT: 'gpx_export',
  OFFLINE_MAPS: 'offline_maps',
} as const;

export type ProFeatureKey = (typeof PRO_FEATURE_KEYS)[keyof typeof PRO_FEATURE_KEYS];

export interface ProFeature {
  key: ProFeatureKey;
  title: string;
  description: string;
}

export const PRO_FEATURES: readonly ProFeature[] = [
  {
    key: PRO_FEATURE_KEYS.BIKES,
    title: 'Unlimited bikes',
    description: `Free covers ${FREE_TIER_LIMITS.MAX_BIKES} bike. Daily commuter, track day weapon, vintage project — Pro puts them all in one garage, each with its own service history.`,
  },
  {
    key: PRO_FEATURE_KEYS.AI_DIAGNOSTICS,
    title: 'Unlimited AI diagnostics',
    description: `Snap a photo of any part or warning light and get severity, fix steps and parts cost. Free includes ${FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH} a month; Pro removes the cap.`,
  },
  {
    key: PRO_FEATURE_KEYS.AI_EXTRAS,
    title: 'More AI, every month',
    description: `Unlimited AI articles, trip-assistant questions and AI ride summaries — free includes ${FREE_TIER_LIMITS.MAX_ARTICLES_PER_MONTH}, ${AI_FEATURE_LIMITS.FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH} and ${AI_FEATURE_LIMITS.FREE_RIDE_SUMMARIES_PER_MONTH} a month.`,
  },
  {
    key: PRO_FEATURE_KEYS.RECEIPT_SCANS,
    title: 'Unlimited receipt scans',
    description: `Photograph a workshop invoice or fuel receipt and the expense fills itself in. Free includes ${FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH} scans a month; typing expenses in by hand is always free.`,
  },
  {
    key: PRO_FEATURE_KEYS.GPX_EXPORT,
    title: 'Unlimited GPX export',
    description:
      'Send any trip to your Garmin, TomTom or favourite nav app as a GPX file, as often as you like.',
  },
  {
    key: PRO_FEATURE_KEYS.OFFLINE_MAPS,
    title: 'Offline trip maps',
    description:
      'Download a trip’s maps before you leave, so dead zones on mountain passes never leave you guessing.',
  },
] as const;

export type ComparisonValue = boolean | string;

export interface ComparisonRow {
  name: string;
  free: ComparisonValue;
  pro: ComparisonValue;
}

/** Free-vs-Pro table. Free-for-everyone rows come first, on purpose. */
export const FREE_VS_PRO: readonly ComparisonRow[] = [
  { name: 'Maintenance logging & reminders', free: true, pro: true },
  { name: 'Expense logging', free: true, pro: true },
  { name: 'Bike health reports', free: true, pro: true },
  { name: 'Ride recording, history & stats', free: true, pro: true },
  { name: 'Trip planning & route discovery', free: true, pro: true },
  { name: 'Motorcycles in garage', free: String(FREE_TIER_LIMITS.MAX_BIKES), pro: UNLIMITED_LABEL },
  {
    name: 'AI diagnostic scans',
    free: perMonth(FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH),
    pro: UNLIMITED_LABEL,
  },
  {
    name: 'AI articles',
    free: perMonth(FREE_TIER_LIMITS.MAX_ARTICLES_PER_MONTH),
    pro: UNLIMITED_LABEL,
  },
  {
    name: 'AI trip-assistant questions',
    free: perMonth(AI_FEATURE_LIMITS.FREE_TRIP_ASSISTANT_QUESTIONS_PER_MONTH),
    pro: UNLIMITED_LABEL,
  },
  {
    name: 'AI ride summaries',
    free: perMonth(AI_FEATURE_LIMITS.FREE_RIDE_SUMMARIES_PER_MONTH),
    pro: UNLIMITED_LABEL,
  },
  {
    name: 'Receipt scans',
    free: perMonth(FREE_TIER_LIMITS.MAX_RECEIPT_SCANS_PER_MONTH),
    pro: UNLIMITED_LABEL,
  },
  {
    name: 'GPX export of trips',
    free: perMonth(GPX_EXPORT_LIMITS.FREE_MONTHLY_EXPORTS),
    pro: UNLIMITED_LABEL,
  },
  { name: 'Offline trip maps', free: false, pro: true },
] as const;

/** Short benefit bullets for the pricing card and the checkout success screen. */
export const PRO_BENEFIT_BULLETS: readonly string[] = PRO_FEATURES.map((f) => f.title);
