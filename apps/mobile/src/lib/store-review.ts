import Constants from 'expo-constants';
import { createMMKV, type MMKV } from 'react-native-mmkv';

import { AnalyticsEvent, trackEvent } from './analytics';

let StoreReview: typeof import('expo-store-review') | null = null;
try {
  StoreReview = require('expo-store-review');
} catch {
  // Not available in Expo Go
}

let _storage: MMKV | null = null;
function getStorage(): MMKV {
  if (!_storage) _storage = createMMKV({ id: 'store-review' });
  return _storage;
}

const ACTION_COUNT_KEY = 'review:actionCount';
const REVIEWED_VERSION_KEY = 'review:version';

/**
 * Minimum number of value-moment actions before the review prompt is eligible.
 * The prompt should never fire on a user's very first action — at least one
 * prior value-moment must have happened so we only ask engaged users.
 */
const MIN_ACTIONS_BEFORE_REVIEW = 2;

/**
 * The value-moment that triggered a review request. Used to gate the prompt to
 * genuine moments of delight (after a user gets value), never during onboarding
 * or first bike setup, and recorded on the REVIEW_PROMPTED analytics event.
 */
export const REVIEW_MILESTONE = {
  EXPENSE_LOGGED: 'expense_logged',
  BIKE_EDITED: 'bike_edited',
  MAINTENANCE_TASK_ADDED: 'maintenance_task_added',
  MAINTENANCE_COMPLETED: 'maintenance_completed',
  HEALTH_REPORT_VIEWED: 'health_report_viewed',
  DIAGNOSIS_COMPLETED: 'diagnosis_completed',
  RIDE_COMPLETED: 'ride_completed',
  TRIP_SHARED: 'trip_shared',
  RIDE_SHARED: 'ride_shared',
  TRIP_CREATED: 'trip_created',
} as const;

export type ReviewMilestone = (typeof REVIEW_MILESTONE)[keyof typeof REVIEW_MILESTONE];

let reviewInFlight = false;

/**
 * Requests an App Store / Play Store review at a genuine value-moment.
 *
 * Caller MUST pass the {@link ReviewMilestone} that triggered it. Never call
 * this during onboarding or first bike setup — gate it on a real moment of
 * value (expense logged, maintenance completed, ride finished, etc.). The prompt
 * is suppressed until the user has hit at least {@link MIN_ACTIONS_BEFORE_REVIEW}
 * value-moments, is shown at most once per app version, and is a no-op where the
 * native API is unavailable (e.g. Expo Go).
 */
export async function maybeRequestReview(milestone: ReviewMilestone): Promise<void> {
  const storage = getStorage();
  const count = (storage.getNumber(ACTION_COUNT_KEY) ?? 0) + 1;
  storage.set(ACTION_COUNT_KEY, count);

  try {
    if (!StoreReview || reviewInFlight) return;
    const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
    if (storage.getString(REVIEWED_VERSION_KEY) === currentVersion) return;
    if (count < MIN_ACTIONS_BEFORE_REVIEW) return;

    reviewInFlight = true;
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    trackEvent(AnalyticsEvent.REVIEW_PROMPTED, {
      action_count: count,
      app_version: currentVersion,
      milestone,
    });

    await StoreReview.requestReview();
    storage.set(REVIEWED_VERSION_KEY, currentVersion);
  } catch {
    // Review prompt is non-critical — swallow errors silently
  } finally {
    reviewInFlight = false;
  }
}
