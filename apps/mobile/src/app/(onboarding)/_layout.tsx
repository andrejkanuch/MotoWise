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
      <Stack.Screen name="rider-type" options={{ gestureEnabled: true }} />

      {/* Section B: Your Motorcycle */}
      <Stack.Screen name="your-bike" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-photo" options={{ gestureEnabled: true }} />

      {/* Section C: Preferences & Goals */}
      <Stack.Screen name="preferences" options={{ gestureEnabled: true }} />
      <Stack.Screen name="goals" options={{ gestureEnabled: true }} />
      <Stack.Screen name="notifications" options={{ gestureEnabled: true }} />

      {/* Section D: Building, Paywall & Welcome Home */}
      <Stack.Screen name="building" options={{ gestureEnabled: false }} />
      <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
      <Stack.Screen name="welcome-home" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
