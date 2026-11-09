import { useRideStore } from '../../stores/ride.store';

export const RIDE_ROUTE = {
  HUD: '/(modals)/ride-hud',
  START: '/(modals)/start-ride',
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

/** `rideRouteFor` for the current ride store. */
export function useRideRoute(): RideRoute {
  const status = useRideStore((s) => s.status);
  const recordingInterrupted = useRideStore((s) => s.recordingInterrupted);
  return rideRouteFor({ status, recordingInterrupted });
}
