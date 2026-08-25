import Constants from 'expo-constants';
import { Alert, Linking } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';

import i18n from '../i18n';
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
 * Where unhappy soft-ask responders are routed instead of a public 1-star review.
 *
 * MUST stay `support@` — that is the address all 46 Play listings, the privacy
 * policy and the web app publish. `hello@` was the last inconsistent use of a
 * second address in app code, and this is the worst place to get it wrong: it is
 * the escape hatch for the exact users who would otherwise leave a 1-star review.
 */
const FEEDBACK_EMAIL = 'support@motovault.app';

/**
 * Minimum number of value-moment actions before the review prompt is eligible.
 * The prompt should never fire on a user's very first action — at least one
 * prior value-moment must have happened so we only ask engaged users.
 */
const MIN_ACTIONS_BEFORE_REVIEW = 2;

/**
 * The value-moment that triggered a review request. Used to gate the prompt to
 * genuine moments of delight (after a user gets value), never during onboarding
 * or first bike setup, and recorded on the review analytics events.
 */
export const REVIEW_MILESTONE = {
  EXPENSE_LOGGED: 'expense_logged',
  BIKE_EDITED: 'bike_edited',
  MAINTENANCE_TASK_ADDED: 'maintenance_task_added',
  MAINTENANCE_COMPLETED: 'maintenance_completed',
  HEALTH_REPORT_VIEWED: 'health_report_viewed',
  DIAGNOSIS_COMPLETED: 'diagnosis_completed',
  RIDE_COMPLETED: 'ride_completed',
  RIDE_SHARED: 'ride_shared',
  TRIP_CREATED: 'trip_created',
} as const;

export type ReviewMilestone = (typeof REVIEW_MILESTONE)[keyof typeof REVIEW_MILESTONE];

let reviewInFlight = false;

interface SoftAskContext {
  count: number;
  version: string;
  milestone?: ReviewMilestone;
}

/** Analytics properties shared by every review event, with the milestone only when known. */
function reviewProps(ctx: SoftAskContext): Record<string, string | number> {
  const props: Record<string, string | number> = {
    action_count: ctx.count,
    app_version: ctx.version,
  };
  if (ctx.milestone) props.milestone = ctx.milestone;
  return props;
}

/**
 * Requests an App Store / Play Store review at a genuine value-moment.
 *
 * Pass the {@link ReviewMilestone} that triggered it when known (recorded on the
 * analytics events). Never call this during onboarding or first bike setup — gate
 * it on a real moment of value (expense logged, maintenance completed, ride
 * finished, etc.). The prompt is suppressed until the user has hit at least
 * {@link MIN_ACTIONS_BEFORE_REVIEW} value-moments, is shown at most once per app
 * version, and is a no-op where the native API is unavailable (e.g. Expo Go).
 *
 * A lightweight "soft ask" (a themed confirm) gates the native prompt: only
 * riders who say they're enjoying the app reach Apple's native rating dialog
 * (which is throttled to ~3 shows/year), while unhappy riders are routed to
 * private feedback instead of a public 1-star review.
 */
export async function maybeRequestReview(milestone?: ReviewMilestone): Promise<void> {
  const storage = getStorage();
  const count = (storage.getNumber(ACTION_COUNT_KEY) ?? 0) + 1;
  storage.set(ACTION_COUNT_KEY, count);

  try {
    if (!StoreReview || reviewInFlight) return;
    const version = Constants.expoConfig?.version ?? '1.0.0';
    if (storage.getString(REVIEWED_VERSION_KEY) === version) return;
    if (count < MIN_ACTIONS_BEFORE_REVIEW) return;

    reviewInFlight = true;
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;

    // Stamp the version now so the soft ask is shown at most once per version,
    // even if the rider dismisses it without answering.
    storage.set(REVIEWED_VERSION_KEY, version);
    presentSoftAsk({ count, version, milestone });
  } catch {
    // Review prompt is non-critical — swallow errors silently
  } finally {
    reviewInFlight = false;
  }
}

/** Step 1: ask whether the rider is enjoying the app before spending the native prompt. */
function presentSoftAsk(ctx: SoftAskContext): void {
  trackEvent(AnalyticsEvent.REVIEW_SOFT_ASK_SHOWN, reviewProps(ctx));

  Alert.alert(i18n.t('review.softAskTitle'), i18n.t('review.softAskBody'), [
    { text: i18n.t('review.softAskNo'), style: 'cancel', onPress: () => onSoftAskNegative() },
    { text: i18n.t('review.softAskYes'), style: 'default', onPress: () => onSoftAskPositive(ctx) },
  ]);
}

/** Happy rider → fire the native store rating dialog. */
async function onSoftAskPositive(ctx: SoftAskContext): Promise<void> {
  trackEvent(AnalyticsEvent.REVIEW_SOFT_ASK_POSITIVE, reviewProps(ctx));

  try {
    trackEvent(AnalyticsEvent.REVIEW_PROMPTED, reviewProps(ctx));
    await StoreReview?.requestReview();
  } catch {
    // Native prompt is non-critical — swallow errors silently
  }
}

/** Unhappy rider → offer a private feedback path instead of a public review. */
function onSoftAskNegative(): void {
  trackEvent(AnalyticsEvent.REVIEW_SOFT_ASK_NEGATIVE, {});

  Alert.alert(i18n.t('review.feedbackTitle'), i18n.t('review.feedbackBody'), [
    { text: i18n.t('review.feedbackNo'), style: 'cancel' },
    { text: i18n.t('review.feedbackYes'), style: 'default', onPress: () => openFeedback() },
  ]);
}

function openFeedback(): void {
  trackEvent(AnalyticsEvent.REVIEW_FEEDBACK_OPENED, {});
  const subject = encodeURIComponent(i18n.t('review.feedbackSubject'));
  Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}`).catch(() => {
    // No mail client / user cancelled — non-critical
  });
}
