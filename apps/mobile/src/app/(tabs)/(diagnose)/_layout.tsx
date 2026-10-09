import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ErrorFallback } from '../../../components/error-fallback';
import { captureException } from '../../../lib/analytics';
import { useEditorialTheme } from '../../../theme/editorial';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'diagnose' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function DiagnoseLayout() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: t('tabs.diagnose') }} />
      <Stack.Screen
        name="new"
        options={{
          presentation: 'fullScreenModal',
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t('diagnose.resultScreenTitle'),
          headerBackTitle: t('tabs.diagnose'),
        }}
      />
    </Stack>
  );
}
