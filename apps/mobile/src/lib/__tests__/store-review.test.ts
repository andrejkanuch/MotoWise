/**
 * Tests for the value-moment-gated store review prompt (MOT-271).
 *
 * Verifies the prompt is suppressed until the user has hit the minimum number
 * of value-moments, is shown at most once per app version, no-ops when the
 * native action is unavailable, and records the triggering milestone.
 */

const mockStore = new Map<string, string | number>();
const mockTrackEvent = jest.fn();
const mockRequestReview = jest.fn().mockResolvedValue(undefined);
const mockHasAction = jest.fn().mockResolvedValue(true);
const mockIsAvailableAsync = jest.fn().mockResolvedValue(true);

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getNumber: (k: string) => (mockStore.has(k) ? (mockStore.get(k) as number) : undefined),
    getString: (k: string) => (mockStore.has(k) ? (mockStore.get(k) as string) : undefined),
    set: (k: string, v: string | number) => {
      mockStore.set(k, v);
    },
  }),
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  hasAction: () => mockHasAction(),
  requestReview: () => mockRequestReview(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '3.13.0' } },
}));

jest.mock('../analytics', () => ({
  AnalyticsEvent: { REVIEW_PROMPTED: 'review_prompted' },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { maybeRequestReview, REVIEW_MILESTONE } from '../store-review';

const ACTION_COUNT_KEY = 'review:actionCount';
const REVIEWED_VERSION_KEY = 'review:version';

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockHasAction.mockResolvedValue(true);
  mockRequestReview.mockResolvedValue(undefined);
});

describe('maybeRequestReview', () => {
  it('does not prompt on the first value-moment (below threshold)', async () => {
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED);

    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
    // counter still advances so the next value-moment is eligible
    expect(mockStore.get(ACTION_COUNT_KEY)).toBe(1);
  });

  it('prompts once at the threshold and records the milestone', async () => {
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // count 1 — below threshold
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // count 2 — eligible

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'review_prompted',
      expect.objectContaining({ action_count: 2, milestone: 'expense_logged' }),
    );
    expect(mockStore.get(REVIEWED_VERSION_KEY)).toBe('3.13.0');
  });

  it('does not prompt again once the current app version was already prompted', async () => {
    mockStore.set(ACTION_COUNT_KEY, 5);
    mockStore.set(REVIEWED_VERSION_KEY, '3.13.0');

    await maybeRequestReview(REVIEW_MILESTONE.RIDE_COMPLETED);

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('no-ops when the native review action is unavailable', async () => {
    mockHasAction.mockResolvedValue(false);
    mockStore.set(ACTION_COUNT_KEY, 5);

    await maybeRequestReview(REVIEW_MILESTONE.MAINTENANCE_COMPLETED);

    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('prompts at most once per app version across repeated value-moments', async () => {
    mockStore.set(ACTION_COUNT_KEY, 5);

    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // prompts, stamps version
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // version already stamped

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });
});
