// The hook's one promise: exactly one ride_paywall_teaser_evaluated per summary,
// whatever happens to the screen while the stats and RevenueCat reads are in
// flight. The rules themselves are covered in lib/__tests__/ride-milestone-trigger.

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, unknown>();
    return {
      set: (k: string, v: unknown) => store.set(k, v),
      getBoolean: (k: string) => store.get(k) as boolean | undefined,
      getNumber: (k: string) => store.get(k) as number | undefined,
      getString: (k: string) => store.get(k) as string | undefined,
      remove: (k: string) => store.delete(k),
    };
  },
}));
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../../lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
const mockHasHadTrialSnapshot = jest.fn(() => Promise.resolve(false));
jest.mock('../../lib/subscription', () => ({
  hasHadTrialSnapshot: () => mockHasHadTrialSnapshot(),
}));
jest.mock('../../lib/paywall-history', () => ({
  getOnboardingPaywallDismissedAt: () => null,
}));
const mockIsHeadUnitConnected = jest.fn(() => false);
jest.mock('../../../modules/carplay/src', () => ({
  isHeadUnitConnected: () => mockIsHeadUnitConnected(),
}));
jest.mock('../../stores/auth.store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'rider-1' } } }) },
}));
jest.mock('../../stores/ride.store', () => ({
  useRideStore: { getState: () => ({ status: 'ended' }) },
}));
jest.mock('../../stores/subscription.store', () => ({
  useSubscriptionStore: { getState: () => ({ isPro: false, isTrialing: false }) },
}));

import { MeasurementSystem } from '@motovault/types';
import { act, renderHook } from '@testing-library/react-native';
import { trackEvent } from '../../lib/analytics';
import { RIDE_TEASER_TRIGGER, TEASER_SUPPRESSION } from '../../lib/ride-milestone-trigger';
import { useRideTeaserEvaluation } from '../use-ride-teaser-evaluation';

const track = trackEvent as jest.Mock;

/** The fifth qualifying ride of a free rider: the milestone is due, so eligibility is checked. */
const FIFTH_RIDE = {
  rideId: 'ride-5',
  distanceM: 12_000,
  movingS: 1_200,
  measurementSystem: MeasurementSystem.METRIC,
};
const PRIOR_STATS = {
  rideMilestoneStats: { qualifyingRideCount: 4, longestQualifyingDistanceM: 20_000 },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsHeadUnitConnected.mockReturnValue(false);
  mockFetcher.mockResolvedValue(PRIOR_STATS);
});

describe('useRideTeaserEvaluation', () => {
  it('emits one event per summary, with would_show for a due, eligible rider in the shadow phase', async () => {
    await renderHook(() => useRideTeaserEvaluation(FIFTH_RIDE));
    await flush();

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(
      'RIDE_PAYWALL_TEASER_EVALUATED',
      expect.objectContaining({
        ride_id: 'ride-5',
        trigger: RIDE_TEASER_TRIGGER.MILESTONE,
        would_show: true,
        shown: false,
        suppression_reason: TEASER_SUPPRESSION.LIVE_OFF,
        qualifying_ride_count: 5,
      }),
    );
    expect(mockFetcher).toHaveBeenCalledWith(expect.anything(), { excludeRideId: 'ride-5' });
  });

  it('CarPlay connected at open: one event, suppressed as carplay_connected', async () => {
    mockIsHeadUnitConnected.mockReturnValue(true);

    await renderHook(() => useRideTeaserEvaluation(FIFTH_RIDE));
    await flush();

    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][1]).toMatchObject({
      suppression_reason: TEASER_SUPPRESSION.CARPLAY_CONNECTED,
      would_show: false,
    });
  });

  it('reads the CarPlay state at evaluation time, not at mount', async () => {
    // The head unit resolves as connected one render after the summary mounts
    // (useCarPlayConnection starts false). The evaluation must see the truth.
    const stats = deferred<typeof PRIOR_STATS>();
    mockFetcher.mockReturnValue(stats.promise);

    await renderHook(() => useRideTeaserEvaluation(FIFTH_RIDE));
    mockIsHeadUnitConnected.mockReturnValue(true);
    await act(async () => {
      stats.resolve(PRIOR_STATS);
    });

    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][1]).toMatchObject({
      suppression_reason: TEASER_SUPPRESSION.CARPLAY_CONNECTED,
    });
  });

  it('still emits exactly once when the summary unmounts before the reads settle (fast Save)', async () => {
    const stats = deferred<typeof PRIOR_STATS>();
    mockFetcher.mockReturnValue(stats.promise);

    const { unmount } = await renderHook(() => useRideTeaserEvaluation(FIFTH_RIDE));
    await unmount();
    expect(track).not.toHaveBeenCalled();

    await act(async () => {
      stats.resolve(PRIOR_STATS);
    });

    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][1]).toMatchObject({ ride_id: 'ride-5', would_show: true });
  });

  it('a rejected stats read emits once with stats_unavailable, never guessing', async () => {
    mockFetcher.mockRejectedValue(new Error('offline'));

    await renderHook(() => useRideTeaserEvaluation(FIFTH_RIDE));
    await flush();

    expect(track).toHaveBeenCalledTimes(1);
    expect(track.mock.calls[0][1]).toMatchObject({
      suppression_reason: TEASER_SUPPRESSION.STATS_UNAVAILABLE,
      would_show: false,
      qualifying_ride_count: null,
    });
  });

  it('a rerender with the same rideId (even with changed inputs) emits once', async () => {
    const { rerender } = await renderHook((input) => useRideTeaserEvaluation(input), {
      initialProps: FIFTH_RIDE,
    });
    await rerender({ ...FIFTH_RIDE, distanceM: 12_500 });
    await rerender({ ...FIFTH_RIDE, measurementSystem: MeasurementSystem.IMPERIAL });
    await flush();

    expect(track).toHaveBeenCalledTimes(1);
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('a rerender while the reads are in flight does not drop the event', async () => {
    const stats = deferred<typeof PRIOR_STATS>();
    mockFetcher.mockReturnValue(stats.promise);

    const { rerender } = await renderHook((input) => useRideTeaserEvaluation(input), {
      initialProps: FIFTH_RIDE,
    });
    await rerender({ ...FIFTH_RIDE, distanceM: 12_500 });
    await act(async () => {
      stats.resolve(PRIOR_STATS);
    });

    expect(track).toHaveBeenCalledTimes(1);
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a rideId', async () => {
    await renderHook(() => useRideTeaserEvaluation({ ...FIFTH_RIDE, rideId: '' }));
    await flush();

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
