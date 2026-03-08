import { palette } from '@motolearn/design-system';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';

export default function GarageLayout() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  const sheetContentStyle = {
    backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
  };

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: 'systemMaterial',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: t('tabs.garage') }} />
      <Stack.Screen
        name="bike/[id]"
        options={{
          title: t('garage.bikeDetails', { defaultValue: 'Bike Details' }),
          headerLargeTitle: false,
        }}
      />
      <Stack.Screen
        name="add-bike"
        options={{
          title: t('garage.addBike', { defaultValue: 'Add Bike' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="add-maintenance-task"
        options={{
          title: t('garage.addMaintenanceTask', { defaultValue: 'Add Task' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="edit-bike"
        options={{
          title: t('garage.editBike', { defaultValue: 'Edit Motorcycle' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          contentStyle: sheetContentStyle,
        }}
      />
    </Stack>
  );
}
