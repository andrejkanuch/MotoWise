import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { cancelRideReminders } from '../../utils/ride-reminders';
import {
  clearCurrentRide,
  RIDE_PHASE,
  type RidePhase,
  readRideRecord,
} from '../../utils/ride-storage';
import {
  buildRideSummaryHref,
  endRecoveredRide,
  finalizeEndedRide,
  readEndedRideSummary,
  resumeRecoveredRide,
} from './ride-controller';

export interface UnfinishedRide {
  /** Phase of the ride left on the phone, or null when there is none. */
  phase: RidePhase | null;
  /** Recording or paused: it can be picked up again. An ended ride cannot. */
  canResume: boolean;
  resume: () => void;
  /** Ends a recording/paused ride, or reopens the review of an ended one. */
  finish: () => void;
}

/**
 * The ride Start Ride finds on the phone: recording or paused after the app was
 * killed (Resume / End), or ended without being saved — e.g. stopped on CarPlay
 * with no phone UI to open its summary (Review). An ended ride is never offered
 * Resume: the server has completed it, and a resumed segment would be dropped.
 */
export function useUnfinishedRide(): UnfinishedRide {
  const router = useRouter();
  const [phase, setPhase] = useState<RidePhase | null>(null);

  useEffect(() => {
    setPhase(readRideRecord()?.phase ?? null);
  }, []);

  const resume = useCallback(() => {
    void resumeRecoveredRide().then((resumed) => {
      if (resumed) router.replace('/(modals)/ride-hud');
    });
  }, [router]);

  const finish = useCallback(() => {
    const record = readRideRecord();
    setPhase(null);
    if (!record) return;

    if (record.phase === RIDE_PHASE.ENDED) {
      const summary = readEndedRideSummary();
      if (summary) {
        router.replace(buildRideSummaryHref(summary));
        return;
      }
      // Its summary is unreadable, so there is nothing to review; the ride itself
      // is already complete on the server.
      finalizeEndedRide(record.rideId);
      return;
    }

    trackEvent(AnalyticsEvent.RIDE_ABANDONED, { ride_id: record.rideId, recovery_reason: 'crash' });
    // End it like any other ride, from the waypoints already on the phone and
    // trimmed to the last movement — never with distance 0 and no route.
    const summaryHref = endRecoveredRide();
    if (summaryHref) {
      router.replace(summaryHref);
      return;
    }
    void cancelRideReminders();
    clearCurrentRide();
    useRideStore.getState().hydrate();
  }, [router]);

  return {
    phase,
    canResume: phase === RIDE_PHASE.RECORDING || phase === RIDE_PHASE.PAUSED,
    resume,
    finish,
  };
}
