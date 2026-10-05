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
  const isPro = useSubscriptionStore((s) => s.isPro);
  const isTrialing = useSubscriptionStore((s) => s.isTrialing);
  const localGoals = useOnboardingStore((s) => s.ridingGoals);

  // Same key + fetcher as every garage screen, so this shares their cache.
  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    enabled: signedIn,
    meta: { showErrorAlert: false },
  });
  const meQuery = useQuery({ ...meOptions(), enabled: signedIn });

  const serverGoals = ridingGoalsFrom(meQuery.data?.me?.preferences);
  const ridingGoals = serverGoals.length > 0 ? serverGoals : localGoals;
  const bikeCount = bikesQuery.data?.myMotorcycles.length;

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
