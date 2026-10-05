import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { isAnalyticsEnabled, registerSuperProperties, setUserProperties } from '../lib/analytics';
import { buildSuperProperties, personPropertiesFrom } from '../lib/analytics-super-properties';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import { meOptions } from '../lib/query-options';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { useSubscriptionStore } from '../stores/subscription.store';

function ridingGoalsFrom(preferences: unknown): string[] {
  if (typeof preferences !== 'object' || preferences === null) return [];
  const goals = (preferences as { ridingGoals?: unknown }).ridingGoals;
  return Array.isArray(goals) ? goals.filter((g): g is string => typeof g === 'string') : [];
}

/**
 * Keeps the per-feature segmentation super properties (lib/analytics-super-properties)
 * registered on this device and mirrored onto the person. Mounted ONCE, in the
 * root layout's navigation gate (it needs the query client).
 *
 * Re-registers only when a value actually changes. `registerSuperProperties` is
 * consent-gated (a no-op while analytics is off), so consent is part of the
 * change key: a rider who opts in later gets the current values on the next
 * render instead of waiting for one of them to change.
 */
export function useAnalyticsSuperProperties(): void {
  const signedIn = useAuthStore((s) => !!s.session);
  const measurementSystem = useAuthStore((s) => s.measurementSystem);
  // The store holds `false` until RevenueCat answers, so read the tier only once
  // verified — otherwise every cold start tags a Pro rider as free first.
  const isPro = useSubscriptionStore((s) => (s.isVerified ? s.isPro : undefined));
  const isTrialing = useSubscriptionStore((s) => (s.isVerified ? s.isTrialing : undefined));
  const localGoals = useOnboardingStore((s) => s.ridingGoals);

  // Same key + fetcher as every garage screen, so this shares their cache.
  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    enabled: signedIn,
    meta: { showErrorAlert: false },
  });
  const meQuery = useQuery({ ...meOptions(), enabled: signedIn });

  // Signed out, a disabled query still returns the previous account's cached
  // data, and sign-out's reset() has just cleared the super properties — so
  // account-scoped values are left out rather than re-registered from the cache.
  const serverGoals = signedIn ? ridingGoalsFrom(meQuery.data?.me?.preferences) : [];
  // The goals kept on the device belong to whoever onboarded on it and are not
  // cleared on sign-out, so they only stand in while signed out (an anonymous
  // onboarder). Signed in, only the account's own goals count.
  const ridingGoals = signedIn ? serverGoals : localGoals;
  const bikeCount = signedIn ? bikesQuery.data?.myMotorcycles.length : undefined;

  // Rebuilt every render (cheap); the effect below is keyed on its serialized
  // value, so an equal object never re-registers.
  const properties = buildSuperProperties({
    isPro,
    isTrialing,
    bikeCount,
    measurementSystem,
    ridingGoals,
    platform: process.env.EXPO_OS,
  });
  const propertiesKey = JSON.stringify(properties);
  const consented = isAnalyticsEnabled();

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the serialized value so an equal object does not re-register
  useEffect(() => {
    if (!consented) return;
    registerSuperProperties(properties);
    if (signedIn) setUserProperties(personPropertiesFrom(properties));
  }, [propertiesKey, consented, signedIn]);
}
