import { palette } from '@motovault/design-system';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { ErrorFallback } from '../../../components/error-fallback';
import { captureException } from '../../../lib/analytics';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'garage' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function GarageLayout() {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  const sheetSurface = isDark ? palette.neutral900 : palette.neutral50;
  const sheetContentStyle = { backgroundColor: sheetSurface };
  const sheetHeaderStyle = { backgroundColor: sheetSurface };

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBlurEffect: 'systemMaterial',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: isDark ? palette.neutral50 : palette.neutral950,
        headerTitleStyle: { color: isDark ? palette.neutral50 : palette.neutral950 },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('tabs.garage') }} />
      <Stack.Screen
        name="bike/[id]"
        options={{
          title: t('garage.bikeDetails', { defaultValue: 'Bike Details' }),
          headerLargeTitle: false,
          headerBackButtonDisplayMode: 'default',
        }}
      />
      <Stack.Screen
        name="add-bike"
        options={{
          title: t('garage.addBike', { defaultValue: 'Add Bike' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
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
          headerStyle: sheetHeaderStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.85, 1.0],
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="edit-bike"
        options={{
          title: t('garage.editBike', { defaultValue: 'Edit Motorcycle' }),
          presentation: 'card',
          headerLargeTitle: false,
          headerBackButtonDisplayMode: 'default',
        }}
      />
      <Stack.Screen
        name="add-expense"
        options={{
          title: t('garage.addExpense', { defaultValue: 'Add Expense' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.7, 0.9],
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="expense-dashboard"
        options={{
          title: t('expenses.dashboard', { defaultValue: 'Expense Insights' }),
          presentation: 'card',
          headerLargeTitle: false,
          headerBackButtonDisplayMode: 'default',
        }}
      />
      <Stack.Screen
        name="bike-tasks"
        options={{
          title: t('bikeHub.allTasks', { defaultValue: 'All Tasks' }),
          headerLargeTitle: false,
          headerBackButtonDisplayMode: 'default',
        }}
      />
      <Stack.Screen
        name="complete-task"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.65, 0.85, 1.0],
          contentStyle: sheetContentStyle,
        }}
      />
    </Stack>
  );
}
