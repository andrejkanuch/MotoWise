import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEditorialTheme } from '../../theme/editorial';

export default function ModalsLayout() {
  const { t } = useEditorialTheme();
  const { t: tr } = useTranslation();
  // Modal surface — set explicitly (mirrors the garage stack's add-expense
  // pattern) to avoid the duplicate-content bug on formSheet-style presentations.
  // Scheme-resolved, so sheets match the ground in light and dark.
  const sheetContentStyle = { backgroundColor: t.bg };

  return (
    <Stack
      screenOptions={{
        presentation: 'formSheet',
        headerShown: false,
        headerTintColor: t.ink,
        headerTitleStyle: { color: t.ink },
        headerStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="start-ride" />
      {/* Same options as the garage stack's add-bike sheet. */}
      <Stack.Screen
        name="add-bike"
        options={{
          title: tr('garage.addBike', { defaultValue: 'Add Bike' }),
          headerShown: true,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="scan-receipt"
        options={{
          presentation: 'fullScreenModal',
          gestureEnabled: true,
          headerShown: false,
          contentStyle: sheetContentStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [1.0],
        }}
      />
      <Stack.Screen
        name="ride-hud"
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      {/* Not swipe-dismissable: leaving without Save or Discard strands the ended
          ride in local storage, and the next Start Ride reports it as abandoned. */}
      <Stack.Screen
        name="ride-summary"
        options={{
          gestureEnabled: false,
          // gestureEnabled only stops the iOS swipe; an Android form sheet is always
          // draggable, so present it full screen there.
          ...(process.env.EXPO_OS === 'android' ? { presentation: 'fullScreenModal' } : {}),
        }}
      />
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
      <Stack.Screen
        name="carplay/index"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="carplay/cues"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="carplay/onboarding"
        options={{ presentation: 'fullScreenModal', gestureEnabled: true }}
      />
    </Stack>
  );
}
