import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { ErrorFallback } from '../../../components/error-fallback';
import { captureException } from '../../../lib/analytics';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureException(error, { boundary: 'discover' });
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function DiscoverLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Discover' }} />
    </Stack>
  );
}
