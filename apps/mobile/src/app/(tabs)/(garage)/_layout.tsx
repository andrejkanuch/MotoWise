import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function GarageLayout() {
  const { t } = useTranslation();

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
        options={{ title: t('garage.bikeDetails', { defaultValue: 'Bike Details' }) }}
      />
      <Stack.Screen
        name="add-bike"
        options={{
          title: t('garage.addBike', { defaultValue: 'Add Bike' }),
          presentation: 'formSheet',
        }}
      />
      <Stack.Screen
        name="add-maintenance-task"
        options={{
          title: t('garage.addMaintenanceTask', { defaultValue: 'Add Task' }),
          presentation: 'formSheet',
        }}
      />
      <Stack.Screen
        name="edit-bike"
        options={{
          title: t('garage.editBike', { defaultValue: 'Edit Motorcycle' }),
          presentation: 'formSheet',
        }}
      />
    </Stack>
  );
}
