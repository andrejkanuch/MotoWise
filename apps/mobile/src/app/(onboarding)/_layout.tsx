import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0F172A' },
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
      <Stack.Screen name="bike-mileage" options={{ gestureEnabled: true }} />
      <Stack.Screen name="bike-photo" options={{ gestureEnabled: true }} />

      {/* Section C: About Your Riding */}
      <Stack.Screen name="riding-frequency" options={{ gestureEnabled: true }} />
      <Stack.Screen name="riding-goals" options={{ gestureEnabled: true }} />
      <Stack.Screen name="maintenance-style" options={{ gestureEnabled: true }} />
      <Stack.Screen name="repair-spending" options={{ gestureEnabled: true }} />

      {/* Section D: Smart Features Setup */}
      <Stack.Screen name="learning-preferences" options={{ gestureEnabled: true }} />
      <Stack.Screen name="smart-maintenance" options={{ gestureEnabled: true }} />

      {/* Section E: Value Reveal & Conversion */}
      <Stack.Screen name="insights" options={{ gestureEnabled: false }} />
      <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
      <Stack.Screen name="personalizing" options={{ gestureEnabled: false }} />

      {/* Legacy routes (keep for backwards compat, hidden) */}
      <Stack.Screen name="select-bike" options={{ gestureEnabled: true }} />
      <Stack.Screen name="riding-habits" options={{ gestureEnabled: true }} />
    </Stack>
  );
}
