import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { MODAL_ROUTE } from '../../config/routes';
import { useRideStore } from '../../stores/ride.store';
import { buildRideSummaryHref, readEndedRideSummary } from './ride-controller';

export const RIDE_ROUTE = {
  HUD: '/(modals)/ride-hud',
  START: MODAL_ROUTE.START_RIDE,
} as const;
export type RideRoute = (typeof RIDE_ROUTE)[keyof typeof RIDE_ROUTE];

type RideRouteState = {
  status: 'idle' | 'recording' | 'paused' | 'ended';
  recordingInterrupted: boolean;
};

/**
 * Where "the ride" leads from the tab button, Home and a reminder tap: the live
 * HUD for a ride this app is recording, Start Ride otherwise — including an open
 * ride whose GPS is not confirmed running after a relaunch, so the rider picks
 * Resume or End there instead of watching a HUD that records nothing.
 */
export function rideRouteFor({ status, recordingInterrupted }: RideRouteState): RideRoute {
  const active = status === 'recording' || status === 'paused';
  return active && !recordingInterrupted ? RIDE_ROUTE.HUD : RIDE_ROUTE.START;
}

/**
 * Where "the ride" leads, with an ended ride going straight to its review: the
 * summary it ended with (stored with the ride), however it ended — phone, CarPlay,
 * a reminder. Start Ride (which also offers Review) when that summary is unreadable.
 */
export function rideEntryHref(state: RideRouteState): Href {
  if (state.status === 'ended') {
    const summary = readEndedRideSummary();
    if (summary) return buildRideSummaryHref(summary, { recovered: summary.recovered === true });
  }
  return rideRouteFor(state);
}

/**
 * Opens "the ride" from a tap. The destination is worked out at the moment of
 * the tap, from the current state — never from a value cached at render, which
 * could predate the summary an ended ride is reviewed from.
 */
export function useOpenRide(): () => void {
  const router = useRouter();
  return useCallback(() => router.push(rideEntryHref(useRideStore.getState())), [router]);
}
