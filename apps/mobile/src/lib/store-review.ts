import { differenceInMilliseconds, isAfter, subDays } from 'date-fns';
import { AppState, Linking } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';

import { useAuthStore } from '../stores/auth.store';
import { AnalyticsEvent, trackEvent } from './analytics';

/**
 * Happiness engine for the store review request.
 *
 * Every engagement action adds points that fade with their own half-life; the
 * sum is the rider's happiness score. Only the four prompt moments
 * ({@link REVIEW_MOMENT}) may request the native dialog, and only when the score
 * reaches {@link REVIEW_CONFIG}.threshold and the per-device cooldown has
 * elapsed. The native dialog is called directly, with no "Are you enjoying the
 * app?" question first: Apple 5.6.1 and Google Play's In-App Review policy both
 * forbid that pre-filter, and nothing a rider answers anywhere in the app feeds
 * this score.
 */

let StoreReview: typeof import('expo-store-review') | null = null;
try {
  StoreReview = require('expo-store-review');
} catch {
  // Not available in Expo Go
}

export const REVIEW_ACTION = {
  APP_OPEN: 'app_open',
  RIDE_SAVED: 'ride_saved',
  SERVICE: 'service',
  GARAGE_BIKE_ADDED: 'garage_bike_added',
  FLYOVER_WATCHED: 'flyover_watched',
  EXPENSE_OR_TRIP: 'expense_or_trip',
  PRO_SUBSCRIBED: 'pro_subscribed',
} as const;

export type ReviewAction = (typeof REVIEW_ACTION)[keyof typeof REVIEW_ACTION];

/** The only moments that may request the native dialog. */
export const REVIEW_MOMENT = {
  RIDE: 'ride',
  MAINTENANCE: 'maintenance',
  GARAGE_BIKE: 'garage_bike',
  FLYOVER: 'flyover',
} as const;

export type ReviewMoment = (typeof REVIEW_MOMENT)[keyof typeof REVIEW_MOMENT];

/** Where a "Rate MotoVault" tap came from, for `review_store_page_opened`. */
export const REVIEW_STORE_SURFACE = {
  SUPPORT: 'support',
  PROFILE: 'profile',
} as const;

export type ReviewStoreSurface = (typeof REVIEW_STORE_SURFACE)[keyof typeof REVIEW_STORE_SURFACE];

interface ActionWeight {
  readonly points: number;
  readonly halfLifeDays: number;
}

/** Every tunable of the engine, in one place. */
export const REVIEW_CONFIG = {
  threshold: 16,
  cooldownDays: 30,
  /** Events older than this are pruned; their weight is negligible by then. */
  eventRetentionDays: 60,
  /** A ride below either minimum earns no points and cannot prompt. */
  rideMinDistanceM: 5000,
  rideMinDurationS: 600,
  weights: {
    [REVIEW_ACTION.APP_OPEN]: { points: 1, halfLifeDays: 1 },
    [REVIEW_ACTION.RIDE_SAVED]: { points: 8, halfLifeDays: 7 },
    [REVIEW_ACTION.SERVICE]: { points: 6, halfLifeDays: 7 },
    [REVIEW_ACTION.GARAGE_BIKE_ADDED]: { points: 5, halfLifeDays: 7 },
    [REVIEW_ACTION.FLYOVER_WATCHED]: { points: 4, halfLifeDays: 3 },
    [REVIEW_ACTION.EXPENSE_OR_TRIP]: { points: 2, halfLifeDays: 3 },
    [REVIEW_ACTION.PRO_SUBSCRIBED]: { points: 10, halfLifeDays: 14 },
  } satisfies Record<ReviewAction, ActionWeight>,
  /** The action each moment scores unless the caller overrides it. */
  momentAction: {
    [REVIEW_MOMENT.RIDE]: REVIEW_ACTION.RIDE_SAVED,
    [REVIEW_MOMENT.MAINTENANCE]: REVIEW_ACTION.SERVICE,
    [REVIEW_MOMENT.GARAGE_BIKE]: REVIEW_ACTION.GARAGE_BIKE_ADDED,
    [REVIEW_MOMENT.FLYOVER]: REVIEW_ACTION.FLYOVER_WATCHED,
  } satisfies Record<ReviewMoment, ReviewAction>,
} as const;

const STORAGE_ID = 'store-review';
/** Per device: the OS review quota is per device, not per account. */
const COOLDOWN_KEY = 'review:lastRequestedAt';
const LEGACY_KEYS = ['review:actionCount', 'review:version'] as const;
const MS_PER_DAY = 86_400_000;
const SCORE_DECIMALS = 10;
const APP_STATE_ACTIVE = 'active';

interface ScoreEvent {
  /** Action. */
  a: ReviewAction;
  /** Epoch ms. */
  t: number;
}

let _storage: MMKV | null = null;
function getStorage(): MMKV {
  if (!_storage) {
    _storage = createMMKV({ id: STORAGE_ID });
    for (const key of LEGACY_KEYS) _storage.remove(key);
  }
  return _storage;
}

function eventsKey(userId: string): string {
  return `review:events:${userId}`;
}

function currentUserId(): string | null {
  return useAuthStore.getState().session?.user?.id ?? null;
}

function readEvents(userId: string): ScoreEvent[] {
  const raw = getStorage().getString(eventsKey(userId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScoreEvent[]) : [];
  } catch {
    return [];
  }
}

function scoreOf(events: readonly ScoreEvent[], now: Date): number {
  return events.reduce((sum, event) => {
    const weight = REVIEW_CONFIG.weights[event.a];
    if (!weight) return sum;
    const ageDays = Math.max(0, differenceInMilliseconds(now, event.t) / MS_PER_DAY);
    return sum + weight.points * 0.5 ** (ageDays / weight.halfLifeDays);
  }, 0);
}

/** Appends one action for `userId`, pruning events past the retention window. */
function appendEvent(userId: string, action: ReviewAction, now: Date): ScoreEvent[] {
  const cutoff = subDays(now, REVIEW_CONFIG.eventRetentionDays).getTime();
  const events = [
    ...readEvents(userId).filter((e) => e.t >= cutoff),
    { a: action, t: now.getTime() },
  ];
  getStorage().set(eventsKey(userId), JSON.stringify(events));
  return events;
}

/** True when no request was made in the last cooldown window. A future stamp counts as elapsed. */
function cooldownElapsed(now: Date): boolean {
  const stamp = getStorage().getNumber(COOLDOWN_KEY);
  if (stamp === undefined || isAfter(stamp, now)) return true;
  return differenceInMilliseconds(now, stamp) >= REVIEW_CONFIG.cooldownDays * MS_PER_DAY;
}

/** The signed-in rider's current happiness score (0 when signed out). */
export function getReviewScore(): number {
  const userId = currentUserId();
  return userId ? scoreOf(readEvents(userId), new Date()) : 0;
}

/**
 * Adds points for an action that is not a prompt moment (app open, expense,
 * trip, Pro purchase, notification "mark done", receipt-scan save). Never
 * requests the dialog. Signed-out riders record nothing.
 */
export function recordReviewAction(action: ReviewAction): void {
  const userId = currentUserId();
  if (!userId) return;
  appendEvent(userId, action, new Date());
}

export interface MaybeRequestReviewOptions {
  /**
   * The caller's own moment gate (e.g. "2nd ride or later", "not onboarding").
   * `false` still adds the moment's points but never requests. Defaults to true.
   */
  eligible?: boolean;
  /** Scores this action instead of the moment's default from `REVIEW_CONFIG.momentAction`. */
  action?: ReviewAction;
}

/**
 * Called at one of the four prompt moments. Adds the moment's points for the
 * signed-in rider, then requests the native review dialog when, in order: the
 * caller's gate passes (`eligible`), the score is at or above the threshold,
 * the per-device cooldown has elapsed, the app is in the foreground, and the
 * store API is available.
 *
 * Resolves to `true` only when `requestReview()` was actually called — the
 * ride summary uses that to hold its navigation while the dialog is up. The
 * cooldown is stamped right before that call, because the OS may silently
 * decline to show the dialog and the app cannot tell.
 */
export async function maybeRequestReview(
  moment: ReviewMoment,
  { eligible = true, action = REVIEW_CONFIG.momentAction[moment] }: MaybeRequestReviewOptions = {},
): Promise<boolean> {
  const userId = currentUserId();
  if (!userId) return false;
  const now = new Date();
  const score = scoreOf(appendEvent(userId, action, now), now);

  if (!eligible || score < REVIEW_CONFIG.threshold || !cooldownElapsed(now)) return false;
  if (!StoreReview || AppState.currentState !== APP_STATE_ACTIVE) return false;

  try {
    if (!(await StoreReview.isAvailableAsync())) return false;
  } catch {
    return false;
  }

  getStorage().set(COOLDOWN_KEY, now.getTime());
  // `review_prompted` counts requests, not dialogs shown — the OS decides.
  trackEvent(AnalyticsEvent.REVIEW_PROMPTED, {
    moment,
    score: Math.round(score * SCORE_DECIMALS) / SCORE_DECIMALS,
  });
  try {
    await StoreReview.requestReview();
  } catch {
    // Review request is non-critical
  }
  return true;
}

/** What the ride summary already fetched about the rider's recent rides. */
export interface RideReviewOverview {
  lastRideId: string | null;
  last30DaysRideCount: number;
}

export interface RideReviewGateInput {
  distanceM: number;
  durationS: number;
  rideId: string;
  /** This device's saved-ride count for the rider, including this ride. */
  localRideCount: number;
  overview: RideReviewOverview | null;
}

/**
 * The ride moment's gate. `scores`: the ride meets the distance and duration
 * minimums, so it earns points at all. `eligible`: it is also at least the
 * rider's 2nd ride. The overview is computed asynchronously after the ride
 * ends, so it may or may not count this ride yet — when it names this ride as
 * the last one it does, and a prior ride needs a count of 2.
 */
export function rideReviewGate({
  distanceM,
  durationS,
  rideId,
  localRideCount,
  overview,
}: RideReviewGateInput): { scores: boolean; eligible: boolean } {
  const scores =
    distanceM >= REVIEW_CONFIG.rideMinDistanceM && durationS >= REVIEW_CONFIG.rideMinDurationS;
  const overviewCountsThisRide = overview?.lastRideId === rideId;
  const priorRideInOverview = overview
    ? overview.last30DaysRideCount >= (overviewCountsThisRide ? 2 : 1)
    : false;
  return { scores, eligible: scores && (localRideCount >= 2 || priorRideInOverview) };
}

const IOS_REVIEW_HOLD_MS = 1500;
const PLATFORM_IOS = 'ios';

/**
 * How long a screen that is about to navigate away waits after a request, so
 * the dialog shows over it. Android's `requestReview()` already resolves when
 * the flow ends; iOS gives no shown or dismissed signal.
 */
export function reviewDialogHoldMs(os: string | undefined): number {
  return os === PLATFORM_IOS ? IOS_REVIEW_HOLD_MS : 0;
}

/** The slice of the ride summary's `rideOverview` query the ride moment reads. */
export interface RideOverviewSnapshot {
  lastRide?: { id: string } | null;
  last30Days: { rideCount: number };
}

/**
 * The ride moment, end to end: score a ride that meets the minimums, request
 * the dialog when it is also at least the 2nd ride, and resolve only after the
 * dialog has had time to open (see {@link reviewDialogHoldMs}) so the caller
 * navigates away after it, not before.
 */
export async function requestRideReview({
  overview,
  ...ride
}: Omit<RideReviewGateInput, 'overview'> & {
  overview: RideOverviewSnapshot | null | undefined;
}): Promise<void> {
  const gate = rideReviewGate({
    ...ride,
    overview: overview
      ? {
          lastRideId: overview.lastRide?.id ?? null,
          last30DaysRideCount: overview.last30Days.rideCount,
        }
      : null,
  });
  if (!gate.scores) return;
  const requested = await maybeRequestReview(REVIEW_MOMENT.RIDE, { eligible: gate.eligible });
  const holdMs = requested ? reviewDialogHoldMs(process.env.EXPO_OS) : 0;
  if (holdMs > 0) await new Promise((resolve) => setTimeout(resolve, holdMs));
}

/** Share of the flyover that must actually play (not be scrubbed past) to count as watched. */
const FLYOVER_MIN_PLAYED_FRACTION = 0.5;

/**
 * Per-visit gate for the flyover moment: the first natural end of a visit
 * qualifies when playback (not scrubbing) covered at least half the flyover.
 * Scrubbing and restarting never reset it.
 */
export function createFlyoverReviewGate() {
  let played = 0;
  let used = false;
  return {
    /** Playback advanced progress from `from` to `to` (fractions of the flyover). */
    onAdvance(from: number, to: number): void {
      played += Math.max(0, to - from);
    },
    /** The flyover reached its end by playing; true at most once per gate. */
    onNaturalEnd(): boolean {
      if (used || played < FLYOVER_MIN_PLAYED_FRACTION) return false;
      used = true;
      return true;
    },
  };
}

const APP_STORE_ID = '6760291360';
const ANDROID_PACKAGE = 'com.motovault.app';

/**
 * Store pages that open straight on writing a review, in the order to try.
 * Pure so both platforms are testable: jest-expo inlines `process.env.EXPO_OS`.
 * Apple explicitly allows `action=write-review`.
 */
export function getWriteReviewUrls(os: string | undefined): readonly string[] {
  if (os === PLATFORM_IOS) {
    return [`https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`];
  }
  return [
    `market://details?id=${ANDROID_PACKAGE}`,
    `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
  ];
}

/**
 * Opens the store's write-a-review page for MotoVault (the "Rate MotoVault"
 * rows). Not throttled and never touches the review cooldown. Each URL is tried
 * with `openURL` and the next one only when it rejects — `canOpenURL` returns
 * false negatives on Android 11+ without a `<queries>` entry.
 */
export async function openStoreReviewPage(
  surface: ReviewStoreSurface,
  os: string | undefined = process.env.EXPO_OS,
): Promise<void> {
  trackEvent(AnalyticsEvent.REVIEW_STORE_PAGE_OPENED, { surface });
  for (const url of getWriteReviewUrls(os)) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Try the next URL; no store or browser at all is non-critical
    }
  }
}
