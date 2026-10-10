import { RideMilestoneStatsDocument, type RideMilestoneStatsQuery } from '@motovault/graphql';
import type { MeasurementSystem } from '@motovault/types';
import { useEffect, useRef } from 'react';
import { RIDE_TEASER_LIVE } from '../config/feature-flags';
import { useCarPlayConnection } from '../features/carplay/use-carplay';
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
  /** Elapsed minus pauses, as the summary already computes it. */
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
 */
export function useRideTeaserEvaluation(input: RideTeaserEvaluationInput): void {
  const { connected: carPlayConnected } = useCarPlayConnection();
  const evaluatedForRide = useRef<string | null>(null);

  useEffect(() => {
    if (!input.rideId || evaluatedForRide.current === input.rideId) return;
    evaluatedForRide.current = input.rideId;

    let cancelled = false;
    (async () => {
      const [stats, hasHadTrial] = await Promise.all([
        gqlFetcher(RideMilestoneStatsDocument, { excludeRideId: input.rideId })
          .then((data: RideMilestoneStatsQuery): RideTeaserStats => data.rideMilestoneStats)
          .catch((error: unknown) => {
            logger.warn('[RideTeaser] milestone stats unavailable', error);
            return null;
          }),
        hasHadTrialSnapshot(),
      ]);
      if (cancelled) return;

      const userId = useAuthStore.getState().session?.user.id ?? 'anonymous';
      const subscription = useSubscriptionStore.getState();
      const rideStatus = useRideStore.getState().status;

      const evaluation = evaluateRideTeaser({
        ride: { distanceM: input.distanceM, movingS: input.movingS, systemEnded: false },
        priorStats: stats,
        isPro: subscription.isPro,
        isTrialing: subscription.isTrialing,
        carPlayConnected,
        activeRide: rideStatus === 'recording' || rideStatus === 'paused',
        onboardingPaywallDismissedAt: getOnboardingPaywallDismissedAt(),
        measurementSystem: input.measurementSystem,
        shownTriggers: getShownTriggers(userId),
        liveEnabled: RIDE_TEASER_LIVE,
        now: Date.now(),
      });
      trackRideTeaserEvaluated(evaluation, {
        rideId: input.rideId,
        distanceM: input.distanceM,
        hasHadTrial,
        isPro: subscription.isPro,
        isTrialing: subscription.isTrialing,
      });
    })();

    return () => {
      cancelled = true;
    };
    // One evaluation per summary (the ref guard); the inputs are fixed for the life of the screen.
  }, [input.rideId, input.distanceM, input.movingS, input.measurementSystem, carPlayConnected]);
}
