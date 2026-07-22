/**
 * Tests for the value-moment-gated store review prompt (MOT-271) and the
 * soft-ask that gates the native rating dialog.
 *
 * Verifies the soft ask is suppressed until the user has hit the minimum number
 * of value-moments, is shown at most once per app version, no-ops when the
 * native action is unavailable, records the triggering milestone, fires the
 * native prompt only when the rider is happy, and routes unhappy riders to
 * private feedback instead of a public review.
 */

import { Alert, type AlertButton, Linking } from 'react-native';

const mockStore = new Map<string, string | number>();
const mockTrackEvent = jest.fn();
const mockRequestReview = jest.fn().mockResolvedValue(undefined);
const mockHasAction = jest.fn().mockResolvedValue(true);
const mockIsAvailableAsync = jest.fn().mockResolvedValue(true);

/**
 * Which Alert button to auto-press per call, in order. 'last' (the default when
 * the queue is empty) taps the primary action — "Love it" on the soft ask,
 * "Send feedback" on the feedback prompt; 'first' taps the dismissive action;
 * 'none' simulates dismissing without choosing.
 */
let pressQueue: Array<'first' | 'last' | 'none'> = [];

// Spy on the real Alert/Linking rather than replacing the `react-native` module
// wholesale — the jest-expo preset needs the module's other members (Platform).
const alertSpy = jest.spyOn(Alert, 'alert');
const openURLSpy = jest.spyOn(Linking, 'openURL');

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

jest.mock('../../i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

jest.mock('../analytics', () => ({
  AnalyticsEvent: {
    REVIEW_PROMPTED: 'review_prompted',
    REVIEW_SOFT_ASK_SHOWN: 'review_soft_ask_shown',
    REVIEW_SOFT_ASK_POSITIVE: 'review_soft_ask_positive',
    REVIEW_SOFT_ASK_NEGATIVE: 'review_soft_ask_negative',
    REVIEW_FEEDBACK_OPENED: 'review_feedback_opened',
  },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { maybeRequestReview, REVIEW_MILESTONE } from '../store-review';

const ACTION_COUNT_KEY = 'review:actionCount';
const REVIEWED_VERSION_KEY = 'review:version';

beforeEach(() => {
  mockStore.clear();
  jest.clearAllMocks();
  pressQueue = [];
  mockIsAvailableAsync.mockResolvedValue(true);
  mockHasAction.mockResolvedValue(true);
  mockRequestReview.mockResolvedValue(undefined);
  openURLSpy.mockResolvedValue(undefined);
  alertSpy.mockImplementation((_title, _message, buttons?: AlertButton[]) => {
    if (!buttons?.length) return;
    const choice = pressQueue.length ? pressQueue.shift() : 'last';
    if (choice === 'last') buttons[buttons.length - 1]?.onPress?.();
    else if (choice === 'first') buttons[0]?.onPress?.();
  });
});

afterAll(() => {
  alertSpy.mockRestore();
  openURLSpy.mockRestore();
});

describe('maybeRequestReview', () => {
  it('does not show the soft ask on the first value-moment (below threshold)', async () => {
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
    // counter still advances so the next value-moment is eligible
    expect(mockStore.get(ACTION_COUNT_KEY)).toBe(1);
  });

  it('shows the soft ask at the threshold and, when the rider is happy, fires the native prompt', async () => {
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // count 1 — below threshold
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // count 2 — eligible, taps "Love it"

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'review_soft_ask_shown',
      expect.objectContaining({ action_count: 2, milestone: 'expense_logged' }),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'review_prompted',
      expect.objectContaining({ action_count: 2, milestone: 'expense_logged' }),
    );
    expect(mockStore.get(REVIEWED_VERSION_KEY)).toBe('3.13.0');
  });

  it('routes an unhappy rider to private feedback instead of the native prompt', async () => {
    mockStore.set(ACTION_COUNT_KEY, 5);
    pressQueue = ['first', 'last']; // soft ask: "Not really" → feedback: "Send feedback"

    await maybeRequestReview(REVIEW_MILESTONE.RIDE_COMPLETED);

    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('review_soft_ask_negative', expect.anything());
    expect(mockTrackEvent).toHaveBeenCalledWith('review_feedback_opened', expect.anything());
    expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining('mailto:'));
  });

  it('does not open feedback when the unhappy rider declines', async () => {
    mockStore.set(ACTION_COUNT_KEY, 5);
    pressQueue = ['first', 'first']; // soft ask: "Not really" → feedback: "Not now"

    await maybeRequestReview(REVIEW_MILESTONE.RIDE_COMPLETED);

    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(openURLSpy).not.toHaveBeenCalled();
  });

  it('does not show the soft ask again once the current app version was already prompted', async () => {
    mockStore.set(ACTION_COUNT_KEY, 5);
    mockStore.set(REVIEWED_VERSION_KEY, '3.13.0');

    await maybeRequestReview(REVIEW_MILESTONE.RIDE_COMPLETED);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it('no-ops when the native review action is unavailable', async () => {
    mockHasAction.mockResolvedValue(false);
    mockStore.set(ACTION_COUNT_KEY, 5);

    await maybeRequestReview(REVIEW_MILESTONE.MAINTENANCE_COMPLETED);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
    // version is not stamped, so a later eligible moment can still ask
    expect(mockStore.get(REVIEWED_VERSION_KEY)).toBeUndefined();
  });

  it('shows the soft ask at most once per app version across repeated value-moments', async () => {
    mockStore.set(ACTION_COUNT_KEY, 5);

    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // shows, stamps version, taps "Love it"
    await maybeRequestReview(REVIEW_MILESTONE.EXPENSE_LOGGED); // version already stamped

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });
});
