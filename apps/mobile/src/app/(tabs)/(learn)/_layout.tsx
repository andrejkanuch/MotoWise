import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { ErrorFallback } from '../../../components/error-fallback';
import { captureException } from '../../../lib/analytics';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'learn' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function LearnLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Learn' }} />
      <Stack.Screen name="article/[slug]" options={{ title: '', headerBackTitle: 'Learn' }} />
    </Stack>
  );
}
