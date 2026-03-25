import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { ErrorFallback } from '../../../components/error-fallback';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorFallback error={error} onRetry={retry} />;
}

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
