import {
  type MeasurementSystem,
  metersToUnit,
  mileageUnitLabel,
  RIDE_MILESTONE_PAYWALL,
  RIDE_PAYWALL_PLACEMENT,
} from '@motovault/types';
import type { JsonType } from '@posthog/core';
import { createMMKV } from 'react-native-mmkv';
import { AnalyticsEvent, trackEvent } from './analytics';

/**
 * Ride-moment paywall teasers — the pure rules.
 * Plan: docs/plans/2026-10-10-1621-feat-ride-moment-paywall-plumbing-plan.md
 *
 * Two triggers, each its own RevenueCat placement (R2, R3, R8):
 *  - MILESTONE: due once the rider has reached the fifth qualifying ride. "At or
 *    past the fifth" rather than "exactly the fifth" is deliberate: it covers the
 *    late window (a fifth ride whose summary never evaluated, e.g. offline) and
 *    the launch backfill (riders already past five when live cards switch on),
 *    with the once-per-account cap (R10) making it fire a single time.
 *  - LONG_RIDE: the first qualifying ride of 50 or more in the rider's own unit,
 *    when no earlier qualifying ride reached that. Riders already past 50 before
 *    go-live therefore never receive it.
 *
 * The summary card has two states (R6): a `teaser` whose tap opens the paywall
 * and a `hook` whose tap opens Rider Insights. This module decides only whether
 * the teaser is due and, if not, why — `evaluateRideTeaser` is the single source
 * of `would_show` for the shadow-phase event (R11) and for the live card later.
 */

export const RIDE_TEASER_TRIGGER = {
  MILESTONE: RIDE_PAYWALL_PLACEMENT.MILESTONE,
  LONG_RIDE: RIDE_PAYWALL_PLACEMENT.LONG_RIDE,
} as const;

export type RideTeaserTrigger = (typeof RIDE_TEASER_TRIGGER)[keyof typeof RIDE_TEASER_TRIGGER];

/** Why a summary showed no teaser. Every evaluation reports one of these or null (R11). */
export const TEASER_SUPPRESSION = {
  /** The ride itself does not qualify (R1): too short, too little moving time, or system-ended. */
  RIDE_NOT_QUALIFYING: 'ride_not_qualifying',
  /** The qualifying-count read failed or the phone was offline (R7): never guess. */
  STATS_UNAVAILABLE: 'stats_unavailable',
  /** Neither trigger is due on this summary. */
  NOT_DUE: 'not_due',
  /** A trigger was due but this account already had it (R10). */
  ALREADY_SHOWN: 'already_shown',
  IS_PRO: 'is_pro',
  IS_TRIALING: 'is_trialing',
  CARPLAY_CONNECTED: 'carplay_connected',
  ACTIVE_RIDE: 'active_ride',
  ONBOARDING_PAYWALL_COOLDOWN: 'onboarding_paywall_cooldown',
  /** Eligible, but live cards are off: the shadow phase (R14). */
  LIVE_OFF: 'live_off',
} as const;

export type TeaserSuppression = (typeof TEASER_SUPPRESSION)[keyof typeof TEASER_SUPPRESSION];

export interface RideTeaserStats {
  /** Qualifying rides on the server, excluding the ride whose summary is open. */
  qualifyingRideCount: number;
  longestQualifyingDistanceM: number;
}

export interface RideTeaserInput {
  ride: {
    distanceM: number;
    movingS: number;
    /** Ended by the idle sweep, stale-on-start or the headless auto-end — never a teaser (R1). */
    systemEnded: boolean;
  };
  /** `null` when the read failed; the rule then suppresses with STATS_UNAVAILABLE. */
  priorStats: RideTeaserStats | null;
  isPro: boolean;
  isTrialing: boolean;
  carPlayConnected: boolean;
  activeRide: boolean;
  onboardingPaywallDismissedAt: number | null;
  measurementSystem: MeasurementSystem;
  /** Triggers this account has already been shown (R10). */
  shownTriggers: ReadonlySet<string>;
  /** `RIDE_TEASER_LIVE`: false in the shadow phase. */
  liveEnabled: boolean;
  now: number;
}

export interface RideTeaserEvaluation {
  /** The trigger that is due on this summary, whether or not it may show. */
  trigger: RideTeaserTrigger | null;
  /** Due and eligible: in the live phase this is "render the teaser". */
  wouldShow: boolean;
  /** `wouldShow` and live cards are on. Always false in the shadow phase. */
  shown: boolean;
  suppressionReason: TeaserSuppression | null;
  /** Qualifying rides including this one when it qualifies (null when stats are unavailable). */
  qualifyingRideCount: number | null;
  isQualifyingRide: boolean;
}

const MS_PER_HOUR = 3_600_000;

/** Distance in the rider's own unit (R3 reads "50 km or more in the rider's own distance unit"). */
export function distanceInRiderUnit(distanceM: number, system: MeasurementSystem): number {
  return metersToUnit(distanceM, mileageUnitLabel(system));
}

/** R1, applied to the ride whose summary is open. */
export function isQualifyingRide(ride: RideTeaserInput['ride']): boolean {
  return (
    !ride.systemEnded &&
    ride.distanceM >= RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_DISTANCE_M &&
    ride.movingS >= RIDE_MILESTONE_PAYWALL.QUALIFYING_MIN_MOVING_S
  );
}

function dueTrigger(
  input: RideTeaserInput,
  stats: RideTeaserStats,
): { trigger: RideTeaserTrigger | null; alreadyShown: boolean } {
  const countIncludingThis = stats.qualifyingRideCount + 1;
  const milestoneDue = countIncludingThis >= RIDE_MILESTONE_PAYWALL.MILESTONE_RIDE;
  const longRideDue =
    distanceInRiderUnit(input.ride.distanceM, input.measurementSystem) >=
      RIDE_MILESTONE_PAYWALL.LONG_RIDE_THRESHOLD &&
    distanceInRiderUnit(stats.longestQualifyingDistanceM, input.measurementSystem) <
      RIDE_MILESTONE_PAYWALL.LONG_RIDE_THRESHOLD;

  // R10: the milestone teaser wins when both are due on one summary; each shows once ever.
  const candidates: RideTeaserTrigger[] = [];
  if (milestoneDue) candidates.push(RIDE_TEASER_TRIGGER.MILESTONE);
  if (longRideDue) candidates.push(RIDE_TEASER_TRIGGER.LONG_RIDE);
  const unseen = candidates.find((trigger) => !input.shownTriggers.has(trigger));
  if (unseen) return { trigger: unseen, alreadyShown: false };
  return { trigger: null, alreadyShown: candidates.length > 0 };
}

function eligibilitySuppression(input: RideTeaserInput): TeaserSuppression | null {
  if (input.isPro) return TEASER_SUPPRESSION.IS_PRO;
  if (input.isTrialing) return TEASER_SUPPRESSION.IS_TRIALING;
  if (input.carPlayConnected) return TEASER_SUPPRESSION.CARPLAY_CONNECTED;
  if (input.activeRide) return TEASER_SUPPRESSION.ACTIVE_RIDE;
  if (
    input.onboardingPaywallDismissedAt !== null &&
    input.now - input.onboardingPaywallDismissedAt <
      RIDE_MILESTONE_PAYWALL.ONBOARDING_PAYWALL_COOLDOWN_H * MS_PER_HOUR
  ) {
    return TEASER_SUPPRESSION.ONBOARDING_PAYWALL_COOLDOWN;
  }
  return null;
}

/** Pure: same input, same answer. Tested in __tests__/ride-milestone-trigger.test.ts. */
export function evaluateRideTeaser(input: RideTeaserInput): RideTeaserEvaluation {
  const qualifying = isQualifyingRide(input.ride);
  const base = { shown: false, wouldShow: false, isQualifyingRide: qualifying };

  if (!qualifying) {
    return {
      ...base,
      trigger: null,
      suppressionReason: TEASER_SUPPRESSION.RIDE_NOT_QUALIFYING,
      qualifyingRideCount: input.priorStats ? input.priorStats.qualifyingRideCount : null,
    };
  }
  if (!input.priorStats) {
    return {
      ...base,
      trigger: null,
      suppressionReason: TEASER_SUPPRESSION.STATS_UNAVAILABLE,
      qualifyingRideCount: null,
    };
  }

  const qualifyingRideCount = input.priorStats.qualifyingRideCount + 1;
  const { trigger, alreadyShown } = dueTrigger(input, input.priorStats);
  if (!trigger) {
    return {
      ...base,
      trigger: null,
      suppressionReason: alreadyShown
        ? TEASER_SUPPRESSION.ALREADY_SHOWN
        : TEASER_SUPPRESSION.NOT_DUE,
      qualifyingRideCount,
    };
  }

  const suppression = eligibilitySuppression(input);
  if (suppression) {
    return { ...base, trigger, suppressionReason: suppression, qualifyingRideCount };
  }
  if (!input.liveEnabled) {
    return {
      ...base,
      trigger,
      wouldShow: true,
      suppressionReason: TEASER_SUPPRESSION.LIVE_OFF,
      qualifyingRideCount,
    };
  }
  return {
    ...base,
    trigger,
    wouldShow: true,
    shown: true,
    suppressionReason: null,
    qualifyingRideCount,
  };
}

// --- Shown-once state (R10), per account, on the device --------------------------------

const teaserStorage = createMMKV({ id: 'ride-teaser' });

function shownKey(userId: string, trigger: RideTeaserTrigger): string {
  return `shown:${userId}:${trigger}`;
}

export function getShownTriggers(userId: string): Set<string> {
  const shown = new Set<string>();
  for (const trigger of Object.values(RIDE_TEASER_TRIGGER)) {
    if (teaserStorage.getBoolean(shownKey(userId, trigger))) shown.add(trigger);
  }
  return shown;
}

export function markTeaserShown(userId: string, trigger: RideTeaserTrigger): void {
  teaserStorage.set(shownKey(userId, trigger), true);
}

// --- The eligibility event (R11) -----------------------------------------------------

export interface RideTeaserEventContext {
  rideId: string;
  distanceM: number;
  hasHadTrial: boolean | null;
  isPro: boolean;
  isTrialing: boolean;
}

/** One event per evaluation, suppressed cases included: this is the shadow-phase denominator. */
export function rideTeaserEvaluatedProperties(
  evaluation: RideTeaserEvaluation,
  context: RideTeaserEventContext,
): Record<string, JsonType> {
  return {
    ride_id: context.rideId,
    trigger: evaluation.trigger,
    would_show: evaluation.wouldShow,
    shown: evaluation.shown,
    suppression_reason: evaluation.suppressionReason,
    qualifying_ride_count: evaluation.qualifyingRideCount,
    is_qualifying_ride: evaluation.isQualifyingRide,
    distance_m: Math.max(0, Math.round(context.distanceM)),
    is_pro: context.isPro,
    is_trialing: context.isTrialing,
    has_had_trial: context.hasHadTrial,
    platform: process.env.EXPO_OS ?? 'unknown',
  };
}

export function trackRideTeaserEvaluated(
  evaluation: RideTeaserEvaluation,
  context: RideTeaserEventContext,
): void {
  trackEvent(
    AnalyticsEvent.RIDE_PAYWALL_TEASER_EVALUATED,
    rideTeaserEvaluatedProperties(evaluation, context),
  );
}
