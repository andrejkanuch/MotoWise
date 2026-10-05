import type { JsonType } from '@posthog/core';
import { getPrimaryGoal } from '../config/onboarding';

/**
 * Super properties stamped on every PostHog event, so any feature event can be
 * split by tier, garage size, units and onboarding intent without a person join.
 *
 * `platform` exists because the PostHog RN SDK only fills `$os_name` when
 * expo-device is installed (it is not), so mobile events carried no OS at all.
 * App version is NOT duplicated here — the SDK already sets `$app_version` from
 * expo-application.
 */
export const SUPER_PROPERTY = {
  IS_PRO: 'is_pro',
  IS_TRIALING: 'is_trialing',
  BIKE_COUNT: 'bike_count',
  MEASUREMENT_SYSTEM: 'measurement_system',
  ONBOARDING_GOAL_PRIMARY: 'onboarding_goal_primary',
  PLATFORM: 'platform',
} as const;

export interface SuperPropertySources {
  isPro: boolean;
  isTrialing: boolean;
  /** Undefined until the garage query has answered — never guessed as 0. */
  bikeCount: number | undefined;
  measurementSystem: string;
  /** Goals picked in onboarding; empty when the rider never answered. */
  ridingGoals: readonly string[];
  platform: string | undefined;
}

/**
 * Pure mapping from app state to super properties. Unknown values are OMITTED
 * rather than sent as null, so a not-yet-loaded source never overwrites a value
 * PostHog already holds for this device.
 */
export function buildSuperProperties(sources: SuperPropertySources): Record<string, JsonType> {
  const entries: [string, JsonType | undefined][] = [
    [SUPER_PROPERTY.IS_PRO, sources.isPro],
    [SUPER_PROPERTY.IS_TRIALING, sources.isTrialing],
    [SUPER_PROPERTY.BIKE_COUNT, sources.bikeCount],
    [SUPER_PROPERTY.MEASUREMENT_SYSTEM, sources.measurementSystem],
    [
      SUPER_PROPERTY.ONBOARDING_GOAL_PRIMARY,
      // getPrimaryGoal falls back to `just_exploring` for an empty list; a rider
      // who never answered is unknown, not an explorer.
      sources.ridingGoals.length > 0 ? getPrimaryGoal([...sources.ridingGoals]) : undefined,
    ],
    [SUPER_PROPERTY.PLATFORM, sources.platform],
  ];
  return Object.fromEntries(
    entries.filter((entry): entry is [string, JsonType] => entry[1] !== undefined),
  );
}

/** Subset worth keeping on the person too (platform is per-device, not per-person). */
export function personPropertiesFrom(
  superProperties: Record<string, JsonType>,
): Record<string, JsonType> {
  const { [SUPER_PROPERTY.PLATFORM]: _platform, ...person } = superProperties;
  return person;
}
