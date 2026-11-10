import { isAnalyticsEnabled, posthogClient } from './analytics';
import { PAYWALL_SURFACE } from './paywall-surfaces';

/** Boolean PostHog flags the app reads. */
export const FEATURE_FLAG = {
  PAYWALL_VARS_RIDER_INSIGHTS_IOS: 'paywall_vars_rider_insights_ios',
  PAYWALL_VARS_RIDER_INSIGHTS_ANDROID: 'paywall_vars_rider_insights_android',
} as const;

export type FeatureFlag = (typeof FEATURE_FLAG)[keyof typeof FEATURE_FLAG];

/**
 * Whether a boolean flag is on, from the flags PostHog already holds. Off when
 * PostHog cannot be asked: analytics off (pre-consent or declined), flags not
 * loaded yet, the fetch failed with nothing cached, or the read throws. Only a
 * strict `true` counts, so a variant string or a missing flag stays off.
 */
export function isFeatureFlagOn(flag: FeatureFlag): boolean {
  if (!isAnalyticsEnabled()) return false;
  try {
    return posthogClient.getFeatureFlag(flag) === true;
  } catch {
    return false;
  }
}

/**
 * The flag that lets each paywall surface receive custom variables, per
 * platform. Custom variables can crash the native paywall on some SDK and OS
 * combinations, so each surface and platform is switched on separately after a
 * device test. A surface missing here (onboarding included) never gets them.
 */
const PAYWALL_VARIABLES_FLAG: ReadonlyMap<string, Readonly<Record<string, FeatureFlag>>> = new Map([
  [
    PAYWALL_SURFACE.RIDER_INSIGHTS,
    {
      ios: FEATURE_FLAG.PAYWALL_VARS_RIDER_INSIGHTS_IOS,
      android: FEATURE_FLAG.PAYWALL_VARS_RIDER_INSIGHTS_ANDROID,
    },
  ],
]);

/** Whether the paywall on `surface` may receive custom variables on `platform`. */
export function isPaywallVariablesEnabled(
  surface: string | undefined,
  platform: string | undefined = process.env.EXPO_OS,
): boolean {
  if (surface === undefined || platform === undefined) return false;
  const byPlatform = PAYWALL_VARIABLES_FLAG.get(surface);
  const flag = byPlatform && Object.hasOwn(byPlatform, platform) ? byPlatform[platform] : undefined;
  return flag !== undefined && isFeatureFlagOn(flag);
}
