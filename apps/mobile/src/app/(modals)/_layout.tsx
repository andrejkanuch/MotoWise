import { palette } from '@motovault/design-system';
import { Stack } from 'expo-router';
import { useEditorialTheme } from '../../theme/editorial';

export default function ModalsLayout() {
  const { isDark } = useEditorialTheme();
  // Dark-modal surface — this layout has no contentStyle default, so dark modals
  // must set it explicitly (mirrors the garage stack's add-expense pattern) to
  // avoid the duplicate-content bug on formSheet-style presentations.
  const sheetContentStyle = { backgroundColor: isDark ? palette.neutral900 : palette.neutral50 };

  return (
    <Stack
      screenOptions={{
        presentation: 'formSheet',
        headerShown: false,
      }}
    >
      <Stack.Screen name="start-ride" />
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
