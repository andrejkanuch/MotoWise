import { differenceInMinutes } from 'date-fns';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { REVIEW_ACTION, recordReviewAction } from '../lib/store-review';

/** App opens score for the review engine at most this often. */
const APP_OPEN_REVIEW_INTERVAL_MIN = 30;
const APP_STATE_ACTIVE = 'active';

/**
 * Review engine: an app open (cold launch, sign-in or return to foreground)
 * scores at most once per {@link APP_OPEN_REVIEW_INTERVAL_MIN} for the
 * signed-in rider.
 */
export function useReviewAppOpenScoring(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return;
    let lastOpenAt: Date | null = null;
    const recordOpen = () => {
      const now = new Date();
      if (lastOpenAt && differenceInMinutes(now, lastOpenAt) < APP_OPEN_REVIEW_INTERVAL_MIN) return;
      lastOpenAt = now;
      recordReviewAction(REVIEW_ACTION.APP_OPEN);
    };
    if (AppState.currentState === APP_STATE_ACTIVE) recordOpen();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === APP_STATE_ACTIVE) recordOpen();
    });
    return () => sub.remove();
  }, [userId]);
}
