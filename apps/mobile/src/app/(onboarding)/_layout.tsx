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
        animation: 'slide_from_right',
      }}
    >
      {/* Section A: Welcome & Identity */}
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="experience" options={{ gestureEnabled: false }} />

      {/* Section B: Your Motorcycle */}
      <Stack.Screen name="bike-year" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-make" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-model" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-type" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-photo" options={{ gestureEnabled: true }} />

      {/* Section C: Preferences & Maintenance */}
      <Stack.Screen name="currency" options={{ gestureEnabled: true }} />
      <Stack.Screen name="smart-maintenance" options={{ gestureEnabled: true }} />

      {/* Section D: Value Reveal & Conversion */}
      <Stack.Screen name="insights" options={{ gestureEnabled: false }} />
      <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
      <Stack.Screen name="personalizing" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
