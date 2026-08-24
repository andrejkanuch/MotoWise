import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { ErrorFallback } from '../../components/error-fallback';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { captureException } from '../../lib/analytics';
import { resolveOnboardingVariant } from '../../lib/onboarding-experiment';
import { useExperimentStore } from '../../stores/experiment.store';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'onboarding' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function OnboardingLayout() {
  // A/B assignment gate — the variant must be resolved BEFORE any onboarding
  // screen renders (it drives flow order, progress, and analytics). Resolution
  // is instant on later launches (persisted) and capped at ~2s on first launch
  // (offline → 'lean' fallback), so the gate can never hold indefinitely.
  const variant = useExperimentStore((s) => s.onboardingVariant);

  useEffect(() => {
    // Also re-registers the variant super property in a fresh JS runtime.
    void resolveOnboardingVariant();
  }, []);

  if (!variant) {
    return <View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: ONBOARDING_COLORS.background },
        animation: 'ios_from_right',
        animationDuration: 350,
      }}
    >
      {/* Section A: Welcome & Identity */}
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="experience" options={{ gestureEnabled: false }} />

      {/* Section B: Personalization & Bike */}
      <Stack.Screen name="goals" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-setup" options={{ gestureEnabled: true }} />
      <Stack.Screen name="reveal" options={{ gestureEnabled: false }} />
      {/* Value-payoff slot for bike-skippers (shown instead of reveal when no bike) */}
      <Stack.Screen name="no-bike-value" options={{ gestureEnabled: true }} />
      <Stack.Screen name="maintenance" options={{ gestureEnabled: true }} />
      <Stack.Screen name="commitment" options={{ gestureEnabled: false }} />

      {/* Section C: Conversion & Finalization */}
      <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
      {/* A/B 2026 — post-paywall account step + returning-user sign-in */}
      <Stack.Screen name="account" options={{ gestureEnabled: false }} />
      <Stack.Screen name="sign-in" options={{ gestureEnabled: true, presentation: 'card' }} />
      {/* Attribution — post-paywall, non-reversible (no back to account/paywall) */}
      <Stack.Screen name="heard-about" options={{ gestureEnabled: false }} />
      {/* Activation (G7) — quota-exempt "snap a receipt" invitation; skippable */}
      <Stack.Screen name="scan-receipt" options={{ gestureEnabled: false }} />
      <Stack.Screen name="notifications" options={{ gestureEnabled: false }} />
      <Stack.Screen name="personalizing" options={{ gestureEnabled: false }} />

      {/* TODO(2026-06-09): Delete v1 onboarding screens after week-4 metrics confirm v2 is stable.
          These are retained for PostHog feature flag rollback. Unreachable in v2 flow.
          Files to remove: bike-year, bike-make, bike-model, bike-type, bike-photo, currency, smart-maintenance, insights */}
      <Stack.Screen name="bike-year" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-make" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-model" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-type" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-photo" options={{ gestureEnabled: true }} />
      <Stack.Screen name="currency" options={{ gestureEnabled: true }} />
      <Stack.Screen name="smart-maintenance" options={{ gestureEnabled: true }} />
      <Stack.Screen name="insights" options={{ gestureEnabled: true }} />
    </Stack>
  );
}
