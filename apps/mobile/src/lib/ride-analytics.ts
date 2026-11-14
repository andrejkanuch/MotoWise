import type { JsonType } from '@posthog/core';
import { MIN_RIDE_DISTANCE_M, MIN_RIDE_ELAPSED_S } from '../utils/ride-constants';
import { AnalyticsEvent, trackEvent } from './analytics';

/**
 * `ride_completed` is THE canonical "a ride was saved" event. `ride_started`
 * counts every Start tap — test taps included — so it is the top of the funnel,
 * never a count of rides. Count saved rides on `ride_completed` alone and split
 * by `save_trigger` / `auto_ended`.
 *
 * Every client path that keeps a ride fires it exactly once:
 *  - SUMMARY: the rider tapped Save on the ride summary. The phone HUD's End, the
 *    CarPlay Stop, the "End ride" reminder action and the unfinished-ride End all
 *    route there first.
 *  - AUTO_END: the headless 30-minute forgot-to-stop end (`autoEndRide`), where no
 *    summary ever opens. Until 3.21.0 that path only sent `ride_auto_saved`.
 *  - NEW_RIDE: a ride ended but never reviewed, saved as it stands because the
 *    rider started the next one (CarPlay never waits on a phone-side review).
 *
 * Not counted here: a ride closed by the server's idle sweep (no client code
 * runs), and a dead-letter redrive — that replays the server write of a save whose
 * event already fired, so emitting again would count the ride twice.
 * `below_min_ride` marks rides under the HUD's end-ride floors — mostly a Start
 * tap left alone until the 30-minute auto-end. The ride is still saved, so it is
 * still counted; filter `below_min_ride = false` for real-ride insights.
 * `ride_auto_saved` stays as the auto-end diagnostic (idle minutes, waypoints);
 * `ride_ended` is the Stop tap, before the rider chose Save or Discard.
 * A ride that is not kept fires `ride_discarded` instead (see trackRideDiscarded),
 * never `ride_completed`.
 */
export const RIDE_SAVE_TRIGGER = {
  SUMMARY: 'summary',
  AUTO_END: 'auto_end',
  NEW_RIDE: 'new_ride',
} as const;

export type RideSaveTrigger = (typeof RIDE_SAVE_TRIGGER)[keyof typeof RIDE_SAVE_TRIGGER];

const METERS_PER_KM = 1000;
/** `distance_km` keeps one decimal — enough to bucket, without false precision. */
const DISTANCE_KM_PRECISION = 10;

export interface RideCompletedInput {
  trigger: RideSaveTrigger;
  rideId: string;
  motorcycleId: string | null | undefined;
  distanceM: number;
  durationS: number;
  /** Path-specific extras (speeds, shared_to_discover…). */
  properties?: Record<string, JsonType>;
}

export function rideCompletedProperties(input: RideCompletedInput): Record<string, JsonType> {
  const distanceM = Math.max(0, Math.round(input.distanceM));
  const durationS = Math.max(0, Math.round(input.durationS));
  return {
    ...input.properties,
    ride_id: input.rideId,
    motorcycle_id: input.motorcycleId || null,
    distance_m: distanceM,
    distance_km:
      Math.round((distanceM / METERS_PER_KM) * DISTANCE_KM_PRECISION) / DISTANCE_KM_PRECISION,
    duration_s: durationS,
    below_min_ride: durationS < MIN_RIDE_ELAPSED_S || distanceM < MIN_RIDE_DISTANCE_M,
    save_trigger: input.trigger,
    auto_ended: input.trigger === RIDE_SAVE_TRIGGER.AUTO_END,
  };
}

export function trackRideCompleted(input: RideCompletedInput): void {
  trackEvent(AnalyticsEvent.RIDE_COMPLETED, rideCompletedProperties(input));
}

/** Why an ended ride was not kept. */
export const RIDE_DISCARD_REASON = {
  /** Under the HUD's floors: a Start tap, not a ride (issue 365 T09, owner decision D3). */
  BELOW_FLOOR: 'below_floor',
  /** The rider chose Discard on the summary. */
  RIDER: 'rider',
} as const;

export type RideDiscardReason = (typeof RIDE_DISCARD_REASON)[keyof typeof RIDE_DISCARD_REASON];

/** Where the discard happened. */
export const RIDE_DISCARD_TRIGGER = {
  /** "End without saving" on the HUD's minimum-ride guard. */
  GUARD: 'guard',
  /** The headless 30-minute forgot-to-stop end (`autoEndRide`). */
  AUTO_END: 'auto_end',
  /** Discard on the ride summary. */
  SUMMARY: 'summary',
} as const;

export type RideDiscardTrigger = (typeof RIDE_DISCARD_TRIGGER)[keyof typeof RIDE_DISCARD_TRIGGER];

export interface RideDiscardedInput {
  rideId: string;
  distanceM: number;
  durationS: number;
  reason: RideDiscardReason;
  trigger: RideDiscardTrigger;
}

/** `ride_discarded`: the one event for an ended ride that is deleted instead of kept. */
export function trackRideDiscarded(input: RideDiscardedInput): void {
  trackEvent(AnalyticsEvent.RIDE_DISCARDED, {
    ride_id: input.rideId,
    distance_m: Math.max(0, Math.round(input.distanceM)),
    duration_s: Math.max(0, Math.round(input.durationS)),
    reason: input.reason,
    trigger: input.trigger,
  });
}
