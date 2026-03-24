import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'formSheet',
        headerShown: false,
      }}
    >
      <Stack.Screen name="start-ride" />
      <Stack.Screen
        name="ride-hud"
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <Stack.Screen name="ride-summary" />
      <Stack.Screen name="add-ride-expense" />
      <Stack.Screen
        name="ride-detail"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true, headerShown: false }}
      />
    </Stack>
  );
}
