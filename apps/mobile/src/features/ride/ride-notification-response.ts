// What a tap on a forgotten-ride notification does. Shared by the running-app
// listener in _layout and the cold-start check in useRideIdleResponses, because
// "End ride" on an iOS notification can launch a killed app, and a listener
// registered in an effect is not guaranteed to see the response that launched it.

import type { Href } from 'expo-router';
import { NOTIFICATION_ACTION } from '../../lib/notifications';
import { useRideStore } from '../../stores/ride.store';
import { armRideReminders, rideEndTrimTarget } from '../../utils/ride-reminders';
import { rideMMKV } from '../../utils/ride-storage';
import { buildRideSummaryHref, endRideSession } from './ride-controller';

export interface RideIdleResponseData {
  rideId?: string;
  autoEnded?: boolean;
}

// The same response can reach both paths on a cold start; act on it once.
const handledResponses = new Set<string>();

/** Identity of one response: the notification plus the button pressed. */
export function rideIdleResponseKey(response: {
  actionIdentifier: string;
  notification: { request: { identifier: string } };
}): string {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

/**
 * Handle one RIDE_IDLE notification response. Returns where to navigate, or null to
 * stay put. Ending is the only state change and runs through the shared controller,
 * trimmed to the last movement so the forgotten stretch is not saved as riding.
 *
 * A plain tap still never ends the ride: someone opening it to say "I'm still out"
 * must not lose their ride. Only the explicit "End ride" button ends it.
 */
export function handleRideIdleResponse(
  responseKey: string,
  actionId: string,
  data: RideIdleResponseData,
): Href | null {
  if (handledResponses.has(responseKey)) return null;
  handledResponses.add(responseKey);

  // Already closed (client auto-end or server sweep): show what was kept.
  if (data.autoEnded && data.rideId) return `/ride/${data.rideId}` as Href;

  const activeRideId = rideMMKV.getCurrentId();
  // A reminder for a ride that has since been ended or discarded: nothing to do.
  if (!activeRideId || (data.rideId && data.rideId !== activeRideId)) return null;

  if (actionId === NOTIFICATION_ACTION.KEEP_RIDING) {
    void armRideReminders();
    return null;
  }

  if (actionId === NOTIFICATION_ACTION.END_RIDE) {
    const summary = endRideSession('phone', { endAt: rideEndTrimTarget() });
    return summary ? buildRideSummaryHref(summary) : null;
  }

  // Plain tap. If this process is the one recording, the live HUD has Stop one tap
  // away. After an app kill the store is idle and the HUD would show an empty ride,
  // so go to Start Ride, which offers Resume / End for the unfinished ride.
  return useRideStore.getState().status === 'idle' ? '/(modals)/start-ride' : '/(modals)/ride-hud';
}

// --- Deferring until navigation can land ---
//
// Ending a ride and navigating to its summary must happen together. When "End ride"
// launches a killed app, the response arrives while auth is still hydrating and no
// navigator is mounted: ending first and pushing second ended the ride, failed the
// push, and stranded the ride data the summary is meant to clean up. So responses
// wait here until the root layout reports navigation ready, then run in one step.

interface PendingRideIdleResponse {
  key: string;
  actionId: string;
  data: RideIdleResponseData;
}

let pending: PendingRideIdleResponse | null = null;
const subscribers = new Set<() => void>();

/**
 * Accept a RIDE_IDLE response from either source (live listener or cold start).
 * "Still riding" needs no screen — it runs now, which also covers iOS delivering it
 * to a background launch where no UI ever mounts. Everything else waits for
 * `flushPendingRideIdleResponse`. A newer response replaces an older unhandled one.
 */
export function receiveRideIdleResponse(
  key: string,
  actionId: string,
  data: RideIdleResponseData,
): void {
  if (actionId === NOTIFICATION_ACTION.KEEP_RIDING) {
    handleRideIdleResponse(key, actionId, data);
    return;
  }
  if (handledResponses.has(key)) return;
  pending = { key, actionId, data };
  for (const notify of subscribers) notify();
}

/** Run the pending response, if any. Call only when navigation can land. */
export function flushPendingRideIdleResponse(): Href | null {
  const next = pending;
  pending = null;
  return next ? handleRideIdleResponse(next.key, next.actionId, next.data) : null;
}

/** Be told when a response is waiting. Returns the unsubscribe. */
export function subscribeRideIdleResponses(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

/** Test seam. */
export function __resetRideIdleResponsesForTest(): void {
  handledResponses.clear();
  pending = null;
  subscribers.clear();
}
