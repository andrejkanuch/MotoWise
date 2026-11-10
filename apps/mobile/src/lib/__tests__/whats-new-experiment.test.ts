// The What's New holdout: only an arm PostHog actually assigns is held out and
// remembered; every other case shows What's New and stores nothing.

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const store = new Map<string, string>();
    return {
      getString: (k: string) => store.get(k),
      set: (k: string, v: string) => store.set(k, v),
      delete: (k: string) => store.delete(k),
      remove: (k: string) => store.delete(k),
    };
  },
}));

const mockPosthog = {
  reloadFeatureFlagsAsync: jest.fn(),
  register: jest.fn(),
  capture: jest.fn(),
};
const mockSetUserProperties = jest.fn();
let mockAnalyticsEnabled = true;

// A getter: imports are hoisted above `mockPosthog`, so it is read on use, not at mock time.
jest.mock('../analytics', () => ({
  get posthogClient() {
    return mockPosthog;
  },
  isAnalyticsEnabled: () => mockAnalyticsEnabled,
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

import { addDays, subDays } from 'date-fns';
import { WHATS_NEW_ARM, WHATS_NEW_ARM_SOURCE, WHATS_NEW_EXPERIMENT } from '../../config/whats-new';
import { useWhatsNewStore } from '../../stores/whats-new.store';
import { resolveWhatsNewArm } from '../whats-new-experiment';

const ENDS_AT = new Date(WHATS_NEW_EXPERIMENT.ENDS_AT);
const BEFORE_END = subDays(ENDS_AT, 30);
const OLD_EXPERIMENT_KEY = 'whats_new_holdout_2026q1';
const TREATMENT_FALLBACK = { arm: WHATS_NEW_ARM.TREATMENT, source: WHATS_NEW_ARM_SOURCE.FALLBACK };

const flagsWith = (value: unknown) => ({ [WHATS_NEW_EXPERIMENT.FLAG_KEY]: value });
const exposures = () =>
  mockPosthog.capture.mock.calls.filter(([event]) => event === '$feature_flag_called');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: BEFORE_END });
  mockAnalyticsEnabled = true;
  useWhatsNewStore.setState({ holdout: null });
  delete process.env.EXPO_PUBLIC_WHATS_NEW_ARM;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('resolveWhatsNewArm', () => {
  it('holds out a rider PostHog assigns to holdout, remembers it and sends the exposure', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue(flagsWith(WHATS_NEW_ARM.HOLDOUT));

    await expect(resolveWhatsNewArm()).resolves.toEqual({
      arm: WHATS_NEW_ARM.HOLDOUT,
      source: WHATS_NEW_ARM_SOURCE.POSTHOG,
    });
    expect(useWhatsNewStore.getState().holdout).toEqual({
      experimentKey: WHATS_NEW_EXPERIMENT.EXPERIMENT_KEY,
      arm: WHATS_NEW_ARM.HOLDOUT,
    });
    expect(exposures()).toEqual([
      [
        '$feature_flag_called',
        expect.objectContaining({
          $feature_flag: WHATS_NEW_EXPERIMENT.FLAG_KEY,
          $feature_flag_response: WHATS_NEW_ARM.HOLDOUT,
        }),
      ],
    ]);
    expect(mockPosthog.register).toHaveBeenCalledWith({ whats_new_arm: WHATS_NEW_ARM.HOLDOUT });
  });

  it('returns the remembered arm on the next call without asking PostHog again', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue(flagsWith(WHATS_NEW_ARM.HOLDOUT));
    await resolveWhatsNewArm();
    jest.clearAllMocks();

    await expect(resolveWhatsNewArm()).resolves.toEqual({
      arm: WHATS_NEW_ARM.HOLDOUT,
      source: WHATS_NEW_ARM_SOURCE.POSTHOG,
    });
    expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
    expect(exposures()).toEqual([]);
  });

  it('remembers a treatment assignment from PostHog too', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue(flagsWith(WHATS_NEW_ARM.TREATMENT));

    await expect(resolveWhatsNewArm()).resolves.toEqual({
      arm: WHATS_NEW_ARM.TREATMENT,
      source: WHATS_NEW_ARM_SOURCE.POSTHOG,
    });
    expect(useWhatsNewStore.getState().holdout?.arm).toBe(WHATS_NEW_ARM.TREATMENT);
  });

  it("shows What's New and stores nothing when PostHog does not answer in time", async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockReturnValue(new Promise(() => {}));

    const result = resolveWhatsNewArm();
    await jest.advanceTimersByTimeAsync(WHATS_NEW_EXPERIMENT.FLAG_FETCH_TIMEOUT_MS);

    await expect(result).resolves.toEqual(TREATMENT_FALLBACK);
    expect(useWhatsNewStore.getState().holdout).toBeNull();
    expect(exposures()).toEqual([]);
  });

  it("shows What's New and stores nothing when the flag fetch returns no flags", async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue(undefined);

    await expect(resolveWhatsNewArm()).resolves.toEqual(TREATMENT_FALLBACK);
    expect(useWhatsNewStore.getState().holdout).toBeNull();
  });

  it.each([
    ['missing', {}],
    ['disabled', flagsWith(false)],
    ['an unknown variant', flagsWith('control')],
  ])("shows What's New and stores nothing when the flag is %s", async (_label, flags) => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue(flags);

    await expect(resolveWhatsNewArm()).resolves.toEqual(TREATMENT_FALLBACK);
    expect(useWhatsNewStore.getState().holdout).toBeNull();
    expect(exposures()).toEqual([]);
  });

  it("shows What's New without asking PostHog while analytics is off", async () => {
    mockAnalyticsEnabled = false;

    await expect(resolveWhatsNewArm()).resolves.toEqual(TREATMENT_FALLBACK);
    expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
    expect(useWhatsNewStore.getState().holdout).toBeNull();
    expect(mockPosthog.capture).not.toHaveBeenCalled();
  });

  it('ignores an arm remembered for an earlier experiment and asks PostHog again', async () => {
    useWhatsNewStore.setState({
      holdout: { experimentKey: OLD_EXPERIMENT_KEY, arm: WHATS_NEW_ARM.HOLDOUT },
    });
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue(flagsWith(WHATS_NEW_ARM.TREATMENT));

    await expect(resolveWhatsNewArm()).resolves.toEqual({
      arm: WHATS_NEW_ARM.TREATMENT,
      source: WHATS_NEW_ARM_SOURCE.POSTHOG,
    });
    expect(mockPosthog.reloadFeatureFlagsAsync).toHaveBeenCalledTimes(1);
  });

  it("shows everyone What's New after the experiment ends, without asking PostHog", async () => {
    jest.setSystemTime(addDays(ENDS_AT, 1));
    useWhatsNewStore.setState({
      holdout: { experimentKey: WHATS_NEW_EXPERIMENT.EXPERIMENT_KEY, arm: WHATS_NEW_ARM.HOLDOUT },
    });

    await expect(resolveWhatsNewArm()).resolves.toEqual(TREATMENT_FALLBACK);
    expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
  });

  it('lets a dev build force an arm for QA without asking PostHog or storing it', async () => {
    process.env.EXPO_PUBLIC_WHATS_NEW_ARM = WHATS_NEW_ARM.HOLDOUT;

    await expect(resolveWhatsNewArm()).resolves.toEqual({
      arm: WHATS_NEW_ARM.HOLDOUT,
      source: WHATS_NEW_ARM_SOURCE.FALLBACK,
    });
    expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
    expect(useWhatsNewStore.getState().holdout).toBeNull();
  });

  it('asks PostHog once when two decisions race', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue(flagsWith(WHATS_NEW_ARM.HOLDOUT));

    await Promise.all([resolveWhatsNewArm(), resolveWhatsNewArm()]);

    expect(mockPosthog.reloadFeatureFlagsAsync).toHaveBeenCalledTimes(1);
    expect(exposures()).toHaveLength(1);
  });
});
