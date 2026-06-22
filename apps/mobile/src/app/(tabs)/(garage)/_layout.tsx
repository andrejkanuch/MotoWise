import { palette } from '@motovault/design-system';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '../../../components/error-fallback';
import { captureException } from '../../../lib/analytics';
import { useEditorialTheme } from '../../../theme/editorial';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'garage' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function GarageLayout() {
  const { t } = useTranslation();
  const { isDark } = useEditorialTheme();

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
      <Stack.Screen name="index" options={{ title: t('tabs.garage'), headerShown: false }} />
      <Stack.Screen
        name="bike/[id]"
        options={{
          title: t('garage.bikeDetails', { defaultValue: 'Bike Details' }),
          headerShown: false,
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
        name="record-maintenance"
        options={{
          title: t('garage.recordMaintenance', { defaultValue: 'Record Maintenance' }),
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
          headerTransparent: false,
          headerStyle: {
            backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
          },
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
          headerTransparent: false,
          headerStyle: {
            backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
          },
          headerBackButtonDisplayMode: 'default',
        }}
      />
      <Stack.Screen
        name="bike-tasks"
        options={{
          title: t('bikeHub.allTasks', { defaultValue: 'All Tasks' }),
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: {
            backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
          },
          headerBackButtonDisplayMode: 'default',
        }}
      />
      <Stack.Screen
        name="health-report"
        options={{
          title: t('healthReport.title', { defaultValue: 'Service Report' }),
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: {
            backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
          },
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
      <Stack.Screen
        name="add-document"
        options={{
          title: t('documents.addTitle', { defaultValue: 'Add Document' }),
          presentation: 'fullScreenModal',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          contentStyle: sheetContentStyle,
          headerBackButtonDisplayMode: 'default',
        }}
      />
      <Stack.Screen
        name="document/[id]"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="manage-document-categories"
        options={{
          title: t('documents.manageCategories', { defaultValue: 'Manage Categories' }),
          presentation: 'fullScreenModal',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          contentStyle: sheetContentStyle,
          headerBackButtonDisplayMode: 'default',
        }}
      />
    </Stack>
  );
}
