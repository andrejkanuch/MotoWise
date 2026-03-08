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
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="select-bike" options={{ gestureEnabled: true }} />
      <Stack.Screen name="riding-habits" options={{ gestureEnabled: true }} />
      <Stack.Screen name="learning-preferences" options={{ gestureEnabled: true }} />
      <Stack.Screen name="insights" options={{ gestureEnabled: false }} />
      <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
      <Stack.Screen name="personalizing" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
