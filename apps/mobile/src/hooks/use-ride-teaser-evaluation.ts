import { RideMilestoneStatsDocument, type RideMilestoneStatsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { useEffect, useRef } from 'react';
import { isHeadUnitConnected } from '../../modules/carplay/src';
import { RIDE_TEASER_LIVE } from '../config/feature-flags';
import { gqlFetcher } from '../lib/graphql-client';
import { logger } from '../lib/logger';
import { getOnboardingPaywallDismissedAt } from '../lib/paywall-history';
import {
  evaluateRideTeaser,
  getShownTriggers,
  type RideTeaserStats,
  trackRideTeaserEvaluated,
} from '../lib/ride-milestone-trigger';
import { hasHadTrialSnapshot } from '../lib/subscription';
import { useAuthStore } from '../stores/auth.store';
import { useRideStore } from '../stores/ride.store';
import { useSubscriptionStore } from '../stores/subscription.store';

interface RideTeaserEvaluationInput {
  rideId: string;
  distanceM: number;
  /** Elapsed minus manual AND auto pauses: the server's `computeMovingTimeS` definition (R1). */
  movingS: number;
  measurementSystem: MeasurementSystem;
}

/**
 * Evaluate the ride-moment paywall teaser once per ride summary and emit the
 * eligibility event (plan R11). Runs when the summary opens, not on Save: the
 * ride is already completed server-side at Stop, and Save closes the screen.
 *
 * Shadow phase: `RIDE_TEASER_LIVE` is false, so nothing renders and nothing
 * opens — the event's `would_show` is the baseline the live cards are judged
 * against. Offline or a failed stats read suppresses (R7) rather than guessing.
 *
 * Exactly one event per summary: the effect is keyed on `rideId` alone and is
 * never cancelled. A rerender, a CarPlay connect/disconnect, or a Save/Discard
 * while the reads are in flight must not drop the event (it is a pure side
 * effect with no UI), so volatile inputs are read through a ref at evaluation
 * time and the CarPlay state straight from the native module.
 */
export function useRideTeaserEvaluation(input: RideTeaserEvaluationInput): void {
  const evaluatedForRide = useRef<string | null>(null);
  const latestInput = useRef(input);
  latestInput.current = input;

  const { rideId } = input;
  useEffect(() => {
    if (!rideId || evaluatedForRide.current === rideId) return;
    evaluatedForRide.current = rideId;

    void (async () => {
      const [stats, hasHadTrial] = await Promise.all([
        gqlFetcher(RideMilestoneStatsDocument, { excludeRideId: rideId })
          .then((data: RideMilestoneStatsQuery): RideTeaserStats => data.rideMilestoneStats)
          .catch((error: unknown) => {
            logger.warn('[RideTeaser] milestone stats unavailable', error);
            return null;
          }),
        hasHadTrialSnapshot(),
      ]);

      const { distanceM, movingS, measurementSystem } = latestInput.current;
      const userId = useAuthStore.getState().session?.user.id ?? 'anonymous';
      const subscription = useSubscriptionStore.getState();
      const rideStatus = useRideStore.getState().status;

      const evaluation = evaluateRideTeaser({
        ride: { distanceM, movingS, systemEnded: false },
        priorStats: stats,
        isPro: subscription.isPro,
        isTrialing: subscription.isTrialing,
        carPlayConnected: isHeadUnitConnected(),
        activeRide: rideStatus === 'recording' || rideStatus === 'paused',
        onboardingPaywallDismissedAt: getOnboardingPaywallDismissedAt(),
        measurementSystem,
        shownTriggers: getShownTriggers(userId),
        liveEnabled: RIDE_TEASER_LIVE,
        now: Date.now(),
      });
      trackRideTeaserEvaluated(evaluation, {
        rideId,
        distanceM,
        hasHadTrial,
        isPro: subscription.isPro,
        isTrialing: subscription.isTrialing,
      });
    })();
  }, [rideId]);
}
