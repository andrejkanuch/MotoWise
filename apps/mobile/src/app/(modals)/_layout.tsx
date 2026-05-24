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
      <Stack.Screen
        name="group-ride-detail"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true, headerShown: false }}
      />
      <Stack.Screen
        name="ride-flyover"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true, headerShown: false }}
      />
      <Stack.Screen
        name="whats-new"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true }}
      />
      <Stack.Screen name="create-group-ride" />
      <Stack.Screen
        name="create-trip"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true, headerShown: false }}
      />
      <Stack.Screen
        name="trip-detail"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true, headerShown: false }}
      />
      <Stack.Screen
        name="recalls"
        options={{ presentation: 'formSheet', gestureEnabled: true, headerShown: false }}
      />
    </Stack>
  );
}
