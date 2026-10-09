import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HUB_SHEET_RADIUS, useHubTheme } from '../../../components/bike-hub/ui/tokens';
import { ErrorFallback } from '../../../components/error-fallback';
import { FORM_SHEET_DETENTS } from '../../../config/sheet-detents';
import { captureException } from '../../../lib/analytics';
import { useEditorialTheme } from '../../../theme/editorial';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'garage' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function GarageLayout() {
  const { t } = useTranslation();
  const { t: theme, isDark } = useEditorialTheme();
  const hub = useHubTheme();

  const sheetSurface = theme.bg;
  const sheetContentStyle = { backgroundColor: sheetSurface };
  const sheetHeaderStyle = { backgroundColor: sheetSurface };
  const hubSheetContentStyle = { backgroundColor: hub.card };

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        // Follow the APP scheme, not the system appearance (adaptive 'systemMaterial').
        headerBlurEffect: isDark ? 'systemMaterialDark' : 'systemMaterialLight',
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: theme.ink,
        headerTitleStyle: { color: theme.ink },
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
      {/* Bike hub sheets (bike-detail redesign R1). The hub card surface of the active
          colour scheme; each screen draws its own title row. */}
      <Stack.Screen
        name="log-entry"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetCornerRadius: HUB_SHEET_RADIUS,
          sheetAllowedDetents: 'fitToContents',
          contentStyle: hubSheetContentStyle,
        }}
      />
      <Stack.Screen
        name="odometer"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetCornerRadius: HUB_SHEET_RADIUS,
          sheetAllowedDetents: 'fitToContents',
          contentStyle: hubSheetContentStyle,
        }}
      />
      <Stack.Screen
        name="note"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetCornerRadius: HUB_SHEET_RADIUS,
          sheetAllowedDetents: [1.0],
          contentStyle: hubSheetContentStyle,
        }}
      />
      <Stack.Screen
        name="notes"
        options={{
          presentation: 'card',
          headerShown: false,
          contentStyle: { backgroundColor: hub.ground },
        }}
      />
      {/* A note's photos, full screen on the dark ground (system Back closes it). */}
      <Stack.Screen
        name="note-photos"
        options={{
          presentation: 'fullScreenModal',
          animation: 'fade',
          headerShown: false,
          contentStyle: { backgroundColor: hub.ground },
        }}
      />
      <Stack.Screen
        name="add-bike"
        options={{
          headerShown: false,
          title: t('garage.addBike', { defaultValue: 'Add Bike' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: FORM_SHEET_DETENTS.BIKE,
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="add-maintenance-task"
        options={{
          headerShown: false,
          title: t('garage.addMaintenanceTask', { defaultValue: 'Add Task' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: FORM_SHEET_DETENTS.TASK,
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="edit-maintenance-task"
        options={{
          headerShown: false,
          title: t('garage.editMaintenanceTask', { defaultValue: 'Edit Task' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: FORM_SHEET_DETENTS.TASK,
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="edit-bike"
        options={{
          headerShown: false,
          title: t('garage.editBike', { defaultValue: 'Edit Motorcycle' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: FORM_SHEET_DETENTS.BIKE,
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="add-expense"
        options={{
          headerShown: false,
          title: t('garage.addExpense', { defaultValue: 'Add Expense' }),
          presentation: 'formSheet',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: sheetHeaderStyle,
          sheetGrabberVisible: true,
          sheetAllowedDetents: FORM_SHEET_DETENTS.EXPENSE,
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="expense-detail"
        options={{
          // Reuses the existing, fully-translated "Expense" string (receipt-scan
          // review) — no expense-scoped singular-title key exists yet.
          title: t('receiptScan.review.typeExpense', { defaultValue: 'Expense' }),
          presentation: 'card',
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: {
            backgroundColor: theme.bg,
          },
          headerBackButtonDisplayMode: 'default',
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
            backgroundColor: theme.bg,
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
            backgroundColor: theme.bg,
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
            backgroundColor: theme.bg,
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
          sheetAllowedDetents: FORM_SHEET_DETENTS.COMPLETE_TASK,
          contentStyle: sheetContentStyle,
        }}
      />
      <Stack.Screen
        name="add-document"
        options={{
          headerShown: false,
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
