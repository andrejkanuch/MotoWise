import * as Notifications from 'expo-notifications';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { useAuthStore } from '../stores/auth.store';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractRoute(data: Record<string, unknown> | undefined): string | null {
  if (!data?.motorcycleId) return null;
  const id = String(data.motorcycleId);
  if (!UUID_RE.test(id)) return null; // Security: validate UUID
  return `/(tabs)/(garage)/bike/${id}`;
}

export function useNotificationDeepLink() {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const pendingRoute = useRef<string | null>(null);
  const isReady = useMemo(
    () => !isLoading && !!session && segments[0] === '(tabs)',
    [isLoading, session, segments[0]],
  );
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;

  // Cold start — read the last notification response that launched the app
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const route = extractRoute(
      lastResponse.notification.request.content.data as Record<string, unknown> | undefined,
    );
    if (!route) return;
    if (isReady) {
      router.push(route as never);
      Notifications.clearLastNotificationResponse();
    } else {
      pendingRoute.current = route;
    }
  }, [lastResponse, isReady, router]);

  // Flush pending route when navigation becomes ready
  useEffect(() => {
    if (isReady && pendingRoute.current) {
      const route = pendingRoute.current;
      pendingRoute.current = null;
      router.push(route as never);
    }
  }, [isReady, router]);

  // Warm start — listen for notification taps while the app is running
  // Uses ref for isReady to avoid tearing down the listener on every segment change
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const route = extractRoute(
        response.notification.request.content.data as Record<string, unknown> | undefined,
      );
      if (!route) return;
      if (isReadyRef.current) router.push(route as never);
      else pendingRoute.current = route;
    });
    return () => sub.remove();
  }, [router]);
}
