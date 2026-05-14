import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { ErrorFallback } from '../../components/error-fallback';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { captureException } from '../../lib/analytics';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'onboarding' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function OnboardingLayout() {
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
      <Stack.Screen name="maintenance" options={{ gestureEnabled: true }} />

      {/* Section C: Conversion & Finalization */}
      <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
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
