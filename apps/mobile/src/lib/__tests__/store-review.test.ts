/**
 * Tests for the happiness-engine store review request.
 *
 * The native dialog is requested directly (no sentiment pre-question, which
 * both stores forbid) only at a prompt moment, only when the rider's decayed
 * happiness score reaches the threshold, and at most once per device per
 * cooldown. Also covers the permanent write-a-review link behind the
 * "Rate MotoVault" rows.
 */

import { subDays } from 'date-fns';
import { Alert, AppState, Linking } from 'react-native';

const mockStore = new Map<string, string | number>();
const mockTrackEvent = jest.fn();
const mockRequestReview = jest.fn().mockResolvedValue(undefined);
const mockIsAvailableAsync = jest.fn().mockResolvedValue(true);
let mockUserId: string | null = 'user-a';

// Spy on the real Alert/Linking rather than replacing the `react-native` module
// wholesale — the jest-expo preset needs the module's other members (Platform).
const alertSpy = jest.spyOn(Alert, 'alert');
const openURLSpy = jest.spyOn(Linking, 'openURL');

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getNumber: (k: string) => (mockStore.has(k) ? (mockStore.get(k) as number) : undefined),
    getString: (k: string) => (mockStore.has(k) ? (mockStore.get(k) as string) : undefined),
    contains: (k: string) => mockStore.has(k),
    set: (k: string, v: string | number) => {
      mockStore.set(k, v);
    },
    remove: (k: string) => mockStore.delete(k),
  }),
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  requestReview: () => mockRequestReview(),
}));

jest.mock('../../stores/auth.store', () => ({
  useAuthStore: {
    getState: () => ({ session: mockUserId ? { user: { id: mockUserId } } : null }),
  },
}));

jest.mock('../analytics', () => ({
  AnalyticsEvent: {
    REVIEW_PROMPTED: 'review_prompted',
    REVIEW_STORE_PAGE_OPENED: 'review_store_page_opened',
  },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import {
  createFlyoverReviewGate,
  getReviewScore,
  getWriteReviewUrls,
  maybeRequestReview,
  openStoreReviewPage,
  REVIEW_ACTION,
  REVIEW_MOMENT,
  REVIEW_STORE_SURFACE,
  recordReviewAction,
  requestRideReview,
  reviewDialogHoldMs,
  rideReviewGate,
} from '../store-review';

const NOW = new Date('2026-10-12T12:00:00Z');
const COOLDOWN_KEY = 'review:lastRequestedAt';

/** Records `action` as if it happened `days` ago. */
function recordDaysAgo(action: Parameters<typeof recordReviewAction>[0], days: number) {
  jest.setSystemTime(subDays(NOW, days));
  recordReviewAction(action);
  jest.setSystemTime(NOW);
}

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  mockStore.clear();
  jest.clearAllMocks();
  mockUserId = 'user-a';
  mockIsAvailableAsync.mockResolvedValue(true);
  mockRequestReview.mockResolvedValue(undefined);
  openURLSpy.mockResolvedValue(undefined);
  alertSpy.mockImplementation(() => {});
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  alertSpy.mockRestore();
  openURLSpy.mockRestore();
});

describe('maybeRequestReview', () => {
  it('AE1: a first qualifying ride on a fresh score does not request, but adds 8 points', async () => {
    const requested = await maybeRequestReview(REVIEW_MOMENT.RIDE);

    expect(requested).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(getReviewScore()).toBeCloseTo(8);
  });

  it('AE3: a ride and a service 2 days ago plus a new ride (~19.5) requests the native dialog directly', async () => {
    recordDaysAgo(REVIEW_ACTION.RIDE_SAVED, 2);
    recordDaysAgo(REVIEW_ACTION.SERVICE, 2);

    const requested = await maybeRequestReview(REVIEW_MOMENT.RIDE);

    expect(requested).toBe(true);
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    // Both stores forbid asking the rider's opinion before the native dialog.
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('review_prompted', {
      moment: 'ride',
      score: 19.5,
    });
    expect(mockStore.get(COOLDOWN_KEY)).toBe(NOW.getTime());
  });

  it('AE3: the same two events 6 days ago (~15.7) do not reach the threshold', async () => {
    recordDaysAgo(REVIEW_ACTION.RIDE_SAVED, 6);
    recordDaysAgo(REVIEW_ACTION.SERVICE, 6);

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('decays an 8-point ride from 7 days ago to 4 points', () => {
    recordDaysAgo(REVIEW_ACTION.RIDE_SAVED, 7);

    expect(getReviewScore()).toBeCloseTo(4);
  });

  it('drops events older than 60 days', () => {
    recordDaysAgo(REVIEW_ACTION.PRO_SUBSCRIBED, 61);
    recordReviewAction(REVIEW_ACTION.APP_OPEN);

    expect(getReviewScore()).toBeCloseTo(1);
  });

  it('AE4: a request 12 days ago blocks a new one', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    mockStore.set(COOLDOWN_KEY, subDays(NOW, 12).getTime());

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('AE4: a request 31 days ago no longer blocks', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    mockStore.set(COOLDOWN_KEY, subDays(NOW, 31).getTime());

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(true);
    expect(mockStore.get(COOLDOWN_KEY)).toBe(NOW.getTime());
  });

  it('AE4: a stamp in the future counts as elapsed and is re-stamped', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    mockStore.set(COOLDOWN_KEY, subDays(NOW, -2).getTime());

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(true);
    expect(mockStore.get(COOLDOWN_KEY)).toBe(NOW.getTime());
  });

  it('AE5: expense logging only adds points and never requests', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    recordReviewAction(REVIEW_ACTION.EXPENSE_OR_TRIP);
    recordReviewAction(REVIEW_ACTION.EXPENSE_OR_TRIP);
    recordReviewAction(REVIEW_ACTION.EXPENSE_OR_TRIP);

    expect(getReviewScore()).toBeCloseTo(16);
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('adds the moment points but does not request when the caller marks it ineligible', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE, { eligible: false })).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(getReviewScore()).toBeCloseTo(18);
  });

  it('scores the action override instead of the moment default', async () => {
    await maybeRequestReview(REVIEW_MOMENT.MAINTENANCE, { action: REVIEW_ACTION.APP_OPEN });

    expect(getReviewScore()).toBeCloseTo(1);
  });

  it('does not request or stamp when the store is unavailable', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    mockIsAvailableAsync.mockResolvedValue(false);

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockStore.has(COOLDOWN_KEY)).toBe(false);
  });

  it('does not request while the app is in the background', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    Object.defineProperty(AppState, 'currentState', { value: 'background', configurable: true });

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(false);
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('survives requestReview throwing', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    mockRequestReview.mockRejectedValue(new Error('native failure'));

    await expect(maybeRequestReview(REVIEW_MOMENT.RIDE)).resolves.toBe(true);
  });

  it('keeps score per user, while the cooldown stamp is per device', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    expect(getReviewScore()).toBeCloseTo(20);
    mockStore.set(COOLDOWN_KEY, subDays(NOW, 5).getTime());

    mockUserId = 'user-b';
    expect(getReviewScore()).toBe(0);
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(false);
  });

  it('records nothing while signed out', async () => {
    mockUserId = null;

    expect(await maybeRequestReview(REVIEW_MOMENT.RIDE)).toBe(false);
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);

    expect(mockStore.size).toBe(0);
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('removes the legacy per-version keys on first run without affecting eligibility', async () => {
    mockStore.set('review:version', '3.25.0');
    mockStore.set('review:actionCount', 9);
    // A fresh module instance stands in for the first launch after the update.
    let fresh: typeof import('../store-review') | undefined;
    jest.isolateModules(() => {
      fresh = require('../store-review');
    });
    if (!fresh) throw new Error('module not loaded');
    fresh.recordReviewAction(fresh.REVIEW_ACTION.PRO_SUBSCRIBED);

    expect(await fresh.maybeRequestReview(fresh.REVIEW_MOMENT.RIDE)).toBe(true);
    expect(mockStore.has('review:version')).toBe(false);
    expect(mockStore.has('review:actionCount')).toBe(false);
  });
});

describe('rideReviewGate', () => {
  const LONG = { distanceM: 40_000, durationS: 45 * 60 };

  it('AE1: a first ride on a fresh install whose overview already counts it scores but is not eligible', () => {
    expect(
      rideReviewGate({
        ...LONG,
        rideId: 'r1',
        localRideCount: 1,
        overview: { lastRide: { id: 'r1' }, last30Days: { rideCount: 1 } },
      }),
    ).toEqual({ scores: true, eligible: false });
  });

  it('a first ride the overview has not counted yet is not eligible', () => {
    expect(
      rideReviewGate({
        ...LONG,
        rideId: 'r1',
        localRideCount: 1,
        overview: { lastRide: null, last30Days: { rideCount: 0 } },
      }),
    ).toEqual({ scores: true, eligible: false });
  });

  it('the 3rd local ride of 40 km / 45 min is eligible', () => {
    expect(rideReviewGate({ ...LONG, rideId: 'r3', localRideCount: 3, overview: null })).toEqual({
      scores: true,
      eligible: true,
    });
  });

  it('a reinstall qualifies through a prior ride in the overview not yet counting this one', () => {
    expect(
      rideReviewGate({
        ...LONG,
        rideId: 'r9',
        localRideCount: 1,
        overview: { lastRide: { id: 'r8' }, last30Days: { rideCount: 1 } },
      }),
    ).toEqual({ scores: true, eligible: true });
  });

  it('a reinstall qualifies when the overview already counts this ride and a prior one', () => {
    expect(
      rideReviewGate({
        ...LONG,
        rideId: 'r9',
        localRideCount: 1,
        overview: { lastRide: { id: 'r9' }, last30Days: { rideCount: 2 } },
      }),
    ).toEqual({ scores: true, eligible: true });
  });

  it('AE2: a 3 km / 6 min ride neither scores nor is eligible', () => {
    expect(
      rideReviewGate({
        distanceM: 3000,
        durationS: 360,
        rideId: 'r3',
        localRideCount: 3,
        overview: null,
      }),
    ).toEqual({ scores: false, eligible: false });
  });

  it('a long-distance ride under 10 minutes does not qualify', () => {
    expect(
      rideReviewGate({
        distanceM: 9000,
        durationS: 599,
        rideId: 'r3',
        localRideCount: 3,
        overview: null,
      }),
    ).toEqual({ scores: false, eligible: false });
  });
});

describe('requestRideReview', () => {
  const ride = { distanceM: 25_000, durationS: 1800, rideId: 'ride-2' };

  it('does not ask on a first ride that the overview already counts', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    await requestRideReview({
      ...ride,
      localRideCount: 1,
      overview: { lastRide: { id: 'ride-2' }, last30Days: { rideCount: 1 } },
    });
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('asks on a qualifying 2nd ride and resolves only after the iOS hold', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    let resolved = false;
    const pending = requestRideReview({
      ...ride,
      localRideCount: 1,
      overview: { lastRide: { id: 'ride-1' }, last30Days: { rideCount: 1 } },
    }).then(() => {
      resolved = true;
    });
    await jest.advanceTimersByTimeAsync(1000);
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);
    await jest.advanceTimersByTimeAsync(500);
    await pending;
    expect(resolved).toBe(true);
  });

  it('neither scores nor asks for a ride under the minimums', async () => {
    recordReviewAction(REVIEW_ACTION.PRO_SUBSCRIBED);
    await requestRideReview({ ...ride, distanceM: 3000, localRideCount: 5, overview: null });
    expect(mockRequestReview).not.toHaveBeenCalled();
  });
});

describe('reviewDialogHoldMs', () => {
  it('holds 1.5 s on iOS, which gives no shown or dismissed signal', () => {
    expect(reviewDialogHoldMs('ios')).toBe(1500);
  });

  it('does not hold on Android, where requestReview resolves when the dialog closes', () => {
    expect(reviewDialogHoldMs('android')).toBe(0);
  });
});

describe('createFlyoverReviewGate', () => {
  it('a full natural playback qualifies once, and a replay in the same visit does not', () => {
    const gate = createFlyoverReviewGate();
    gate.onAdvance(0, 0.5);
    gate.onAdvance(0.5, 1);
    expect(gate.onNaturalEnd()).toBe(true);

    gate.onAdvance(0, 1);
    expect(gate.onNaturalEnd()).toBe(false);
  });

  it('scrubbing to the end then playing does not qualify', () => {
    const gate = createFlyoverReviewGate();
    gate.onAdvance(0.98, 1);
    expect(gate.onNaturalEnd()).toBe(false);
  });

  it('qualifies once at least half the flyover was played', () => {
    const gate = createFlyoverReviewGate();
    gate.onAdvance(0.5, 1);
    expect(gate.onNaturalEnd()).toBe(true);
  });
});

describe('getWriteReviewUrls', () => {
  it('returns the App Store write-review URL on iOS', () => {
    expect(getWriteReviewUrls('ios')).toEqual([
      'https://apps.apple.com/app/id6760291360?action=write-review',
    ]);
  });

  it('returns the Play app URL then the web Play listing on Android', () => {
    expect(getWriteReviewUrls('android')).toEqual([
      'market://details?id=com.motovault.app',
      'https://play.google.com/store/apps/details?id=com.motovault.app',
    ]);
  });
});

describe('openStoreReviewPage', () => {
  it('opens the first URL and tracks the surface', async () => {
    await openStoreReviewPage(REVIEW_STORE_SURFACE.SUPPORT, 'android');

    expect(openURLSpy).toHaveBeenCalledTimes(1);
    expect(openURLSpy).toHaveBeenCalledWith('market://details?id=com.motovault.app');
    expect(mockTrackEvent).toHaveBeenCalledWith('review_store_page_opened', {
      surface: 'support',
    });
  });

  it('falls back to the next URL only when opening rejects', async () => {
    openURLSpy.mockRejectedValueOnce(new Error('no handler'));

    await openStoreReviewPage(REVIEW_STORE_SURFACE.SUPPORT, 'android');

    expect(openURLSpy).toHaveBeenCalledTimes(2);
    expect(openURLSpy).toHaveBeenLastCalledWith(
      'https://play.google.com/store/apps/details?id=com.motovault.app',
    );
  });

  it('uses the running OS by default and never touches the cooldown', async () => {
    await openStoreReviewPage(REVIEW_STORE_SURFACE.SUPPORT);

    expect(openURLSpy).toHaveBeenCalledWith(getWriteReviewUrls(process.env.EXPO_OS)[0]);
    expect(mockStore.has(COOLDOWN_KEY)).toBe(false);
  });
});
