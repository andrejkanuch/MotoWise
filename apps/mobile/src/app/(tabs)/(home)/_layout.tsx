import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '@/components/error-fallback';
import { FORM_SHEET_DETENTS } from '@/config/sheet-detents';
import { useInsightsHeaderOptions } from '@/features/rider-insights/use-insights-header-options';
import { captureException } from '@/lib/analytics';
import { useEditorialTheme } from '@/theme/editorial';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'home' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function HomeLayout() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insightsHeader = useInsightsHeaderOptions();
  // Same presentation as the garage stack's copies of these sheets.
  const sheetOptions = {
    headerShown: false,
    presentation: 'formSheet',
    sheetGrabberVisible: true,
    contentStyle: { backgroundColor: theme.bg },
  } as const;

  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* Home's copies of Rider insights, so back from the Home card returns to Home. */}
      <Stack.Screen
        name="home/rider-insights"
        options={{ ...insightsHeader.main, title: t('riderInsights.title') }}
      />
      <Stack.Screen name="home/rider-insights/[group]" options={insightsHeader.page} />
      <Stack.Screen
        name="home/rider-insights/recap"
        options={{ ...insightsHeader.page, title: t('riderInsights.recap.title') }}
      />
      <Stack.Screen
        name="add-maintenance-task"
        options={{ ...sheetOptions, sheetAllowedDetents: FORM_SHEET_DETENTS.TASK }}
      />
      <Stack.Screen
        name="add-expense"
        options={{ ...sheetOptions, sheetAllowedDetents: FORM_SHEET_DETENTS.EXPENSE }}
      />
      {/* Same options as the garage stack's add-bike sheet. */}
      <Stack.Screen
        name="add-bike"
        options={{
          title: t('garage.addBike', { defaultValue: 'Add Bike' }),
          presentation: 'formSheet',
          headerShown: false,
          headerLargeTitle: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: theme.bg },
          sheetGrabberVisible: true,
          sheetAllowedDetents: FORM_SHEET_DETENTS.BIKE,
          contentStyle: { backgroundColor: theme.bg },
        }}
      />
    </Stack>
  );
}
