import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { useRideStore } from '../../stores/ride.store';
import { cancelRideReminders } from '../../utils/ride-reminders';
import {
  clearCurrentRide,
  RIDE_PHASE,
  type RidePhase,
  type RideRecord,
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
/**
 * The ride the banner may show: none while this app is recording it live — that
 * ride is ended from its HUD, never from Start Ride's recovery banner (a ride just
 * started on CarPlay would otherwise be offered End and Resume here).
 */
function unfinishedRecord(): RideRecord | null {
  const record = readRideRecord();
  if (!record) return null;
  const { status, recordingInterrupted } = useRideStore.getState();
  const live = (status === 'recording' || status === 'paused') && !recordingInterrupted;
  return live && record.phase !== RIDE_PHASE.ENDED ? null : record;
}

export function useUnfinishedRide(): UnfinishedRide {
  const router = useRouter();
  // The ride the banner shows. Actions act on THIS ride only: a ride started on
  // CarPlay after the banner rendered must never be ended (or resumed) from it.
  const [shown, setShown] = useState<RideRecord | null>(null);

  useEffect(() => {
    setShown(unfinishedRecord());
  }, []);

  /** The current record if it is still the ride and phase the banner shows. */
  const stillShown = useCallback((): RideRecord | null => {
    const record = unfinishedRecord();
    if (record && shown && record.rideId === shown.rideId && record.phase === shown.phase) {
      return record;
    }
    setShown(record); // moved on: show what is there now, act on nothing
    return null;
  }, [shown]);

  const resume = useCallback(() => {
    if (!stillShown()) return;
    void resumeRecoveredRide().then((resumed) => {
      if (resumed) router.replace('/(modals)/ride-hud');
    });
  }, [router, stillShown]);

  const finish = useCallback(() => {
    const record = stillShown();
    if (!record) return;
    setShown(null);

    if (record.phase === RIDE_PHASE.ENDED) {
      const summary = readEndedRideSummary();
      if (summary) {
        router.replace(buildRideSummaryHref(summary, { recovered: summary.recovered === true }));
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
  }, [router, stillShown]);

  const phase = shown?.phase ?? null;
  return {
    phase,
    canResume: phase === RIDE_PHASE.RECORDING || phase === RIDE_PHASE.PAUSED,
    resume,
    finish,
  };
}
