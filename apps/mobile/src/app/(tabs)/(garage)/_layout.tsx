import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function GarageLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My Garage' }} />
      <Stack.Screen name="bike/[id]" options={{ title: 'Bike Details' }} />
      <Stack.Screen name="add-bike" options={{ title: 'Add Bike', presentation: 'formSheet' }} />
      <Stack.Screen
        name="add-maintenance-task"
        options={{
          title: t('garage.addMaintenanceTask', { defaultValue: 'Add Task' }),
          presentation: 'formSheet',
        }}
      />
    </Stack>
  );
}
