import * as Notifications from 'expo-notifications';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import {
  flushPendingRideIdleResponse,
  type RideIdleResponseData,
  receiveRideIdleResponse,
  rideIdleResponseKey,
  subscribeRideIdleResponses,
} from '../features/ride/ride-notification-response';
import { captureException } from '../lib/analytics';
import { NOTIFICATION_KIND } from '../lib/notifications';
import { useAuthStore } from '../stores/auth.store';

/** Route groups whose navigator is mounted only once the rider is signed in and past
 *  onboarding — the precondition for the ride HUD, Start Ride and summary modals. */
const READY_SEGMENTS: readonly string[] = ['(tabs)', '(modals)'];

/**
 * Runs forgotten-ride notification responses once navigation can land them.
 *
 * Mirrors useNotificationDeepLink's readiness rule (auth hydrated, signed in, inside
 * the app's own groups) but also accepts the modal group, so a tap while the ride HUD
 * is open is handled straight away. Also picks up the response that launched a killed
 * app — once — and clears it so it is not replayed on the next launch.
 */
export function useRideIdleResponses(): void {
  const router = useRouter();
  const segments = useSegments();
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isReady = !isLoading && !!session && READY_SEGMENTS.includes(segments[0] ?? '');

  // Cold start: queue the launching ride reminder; the flush below runs it when ready.
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync()
      .then((last) => {
        const data = last?.notification.request.content.data as
          | (RideIdleResponseData & { kind?: string })
          | undefined;
        if (!last || data?.kind !== NOTIFICATION_KIND.RIDE_IDLE) return;
        void Notifications.clearLastNotificationResponseAsync();
        receiveRideIdleResponse(rideIdleResponseKey(last), last.actionIdentifier, data);
      })
      .catch((err) => captureException(err, { source: 'useRideIdleResponses.coldStart' }));
  }, []);

  // Re-subscribes whenever readiness flips, so a response queued before navigation
  // existed runs the moment it does, and later ones run as they arrive.
  useEffect(() => {
    if (!isReady) return;
    const flush = () => {
      const target = flushPendingRideIdleResponse();
      if (target) router.push(target);
    };
    flush();
    return subscribeRideIdleResponses(flush);
  }, [isReady, router]);
}
