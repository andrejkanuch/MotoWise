// Onboarding paywall A/B (2026-10-07): two new variants, `garage_first` and
// `commit_first`, assigned per install from the PostHog flag
// `onboarding_paywall_2026q4`. Both put the paywall AFTER the account step.
// See docs/plans/2026-10-07-1317-feat-onboarding-paywall-ab-plan.md.

// --- Mocks (must precede the requires below) ---
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

jest.mock('../lib/analytics', () => ({
  AnalyticsEvent: {},
  trackEvent: jest.fn(),
  posthogClient: mockPosthog,
  isAnalyticsEnabled: () => mockAnalyticsEnabled,
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  OB_VARIANT,
  OB_SCREEN,
  ONBOARDING_EXPERIMENT,
  getFlowScreens,
  getNextRoute,
  getPreviousRoute,
  getResumeRoute,
  getVisibleProgress,
  isRetiredScreen,
} = require('../config/onboarding');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useExperimentStore } = require('../stores/experiment.store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveOnboardingVariant } = require('../lib/onboarding-experiment');

const withBike = { hasBike: true };
const noBike = { hasBike: false };

/** Walk the flow forward from welcome, returning every visited screen. */
function walk(variant: string, ctx: { hasBike: boolean }): string[] {
  const visited: string[] = [];
  let current: string = OB_SCREEN.WELCOME;
  for (let i = 0; i < 30; i++) {
    visited.push(current);
    const next = getNextRoute(variant, current, ctx);
    if (!next) break;
    current = next.replace('/(onboarding)/', '') || OB_SCREEN.WELCOME;
  }
  return visited;
}

beforeEach(() => {
  useExperimentStore.getState().reset();
  jest.clearAllMocks();
  jest.useRealTimers();
  mockAnalyticsEnabled = true;
});

describe('garage_first flow', () => {
  it('has no paywall step and no commitment, and ends on personalizing', () => {
    expect(walk(OB_VARIANT.GARAGE_FIRST, withBike)).toEqual([
      OB_SCREEN.WELCOME,
      OB_SCREEN.EXPERIENCE,
      OB_SCREEN.BIKE_SETUP,
      OB_SCREEN.REVEAL,
      OB_SCREEN.GOALS,
      OB_SCREEN.ACCOUNT,
      OB_SCREEN.HEARD_ABOUT,
      OB_SCREEN.NOTIFICATIONS,
      OB_SCREEN.PERSONALIZING,
    ]);
  });
});

describe('commit_first flow', () => {
  it('puts the paywall straight after account, preceded by commitment', () => {
    expect(walk(OB_VARIANT.COMMIT_FIRST, withBike)).toEqual([
      OB_SCREEN.WELCOME,
      OB_SCREEN.EXPERIENCE,
      OB_SCREEN.BIKE_SETUP,
      OB_SCREEN.REVEAL,
      OB_SCREEN.GOALS,
      OB_SCREEN.COMMITMENT,
      OB_SCREEN.ACCOUNT,
      OB_SCREEN.PAYWALL,
      OB_SCREEN.HEARD_ABOUT,
      OB_SCREEN.NOTIFICATIONS,
      OB_SCREEN.PERSONALIZING,
    ]);
  });

  it('a bike-less rider skips commitment but still reaches the paywall after account', () => {
    const visited = walk(OB_VARIANT.COMMIT_FIRST, noBike);
    expect(visited).not.toContain(OB_SCREEN.COMMITMENT);
    expect(visited.indexOf(OB_SCREEN.PAYWALL)).toBe(visited.indexOf(OB_SCREEN.ACCOUNT) + 1);
  });

  it('the paywall is a real step, not a retired pass-through, for commit_first', () => {
    expect(isRetiredScreen(OB_SCREEN.PAYWALL, OB_VARIANT.COMMIT_FIRST)).toBe(false);
    expect(isRetiredScreen(OB_SCREEN.PAYWALL, OB_VARIANT.SHIPPED)).toBe(true);
    expect(getNextRoute(OB_VARIANT.COMMIT_FIRST, OB_SCREEN.PAYWALL, withBike)).toBe(
      '/(onboarding)/heard-about',
    );
  });

  it('Back from heard-about skips the auto-presenting paywall and lands on account', () => {
    expect(getPreviousRoute(OB_VARIANT.COMMIT_FIRST, OB_SCREEN.HEARD_ABOUT)).toBe(
      '/(onboarding)/account',
    );
  });

  it('resuming after a kill on the paywall continues to heard-about', () => {
    expect(getResumeRoute(OB_VARIANT.COMMIT_FIRST, OB_SCREEN.PAYWALL, withBike)).toBe(
      '/(onboarding)/heard-about',
    );
  });
});

describe('both variants keep the paywall after account (KTD2)', () => {
  it.each([
    'garage_first',
    'commit_first',
  ])('%s never reaches the paywall before the account step', (variant) => {
    for (const ctx of [withBike, noBike]) {
      const visited = walk(variant, ctx);
      const paywallAt = visited.indexOf(OB_SCREEN.PAYWALL);
      if (paywallAt !== -1) {
        expect(paywallAt).toBeGreaterThan(visited.indexOf(OB_SCREEN.ACCOUNT));
      }
    }
  });
});

describe('existing installs are untouched (R2)', () => {
  it('shipped and the legacy values keep the paywall-free shipped flow', () => {
    for (const variant of [
      OB_VARIANT.SHIPPED,
      OB_VARIANT.LEAN,
      OB_VARIANT.INVESTED,
      OB_VARIANT.CONTROL,
    ]) {
      expect(getFlowScreens(variant)).not.toContain(OB_SCREEN.PAYWALL);
      expect(getResumeRoute(variant, OB_SCREEN.PAYWALL, withBike)).toBe('/(onboarding)/account');
    }
  });
});

describe('progress counts only the screens a rider actually sees', () => {
  it.each([
    ['garage_first', withBike],
    ['garage_first', noBike],
    ['commit_first', withBike],
    ['commit_first', noBike],
  ])('%s with %o: last visible screen is index total - 1', (variant, ctx) => {
    const visited = walk(variant, ctx);
    const last = visited[visited.length - 1];
    const { index, total } = getVisibleProgress(variant, last, ctx);
    expect(total).toBe(visited.length);
    expect(index).toBe(total - 1);
    // Every visited screen has a contiguous index.
    expect(visited.map((s) => getVisibleProgress(variant, s, ctx).index)).toEqual([
      ...visited.keys(),
    ]);
  });
});

describe('resolveOnboardingVariant for new installs', () => {
  it('uses the PostHog flag value when it names an assignable variant', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({
      [ONBOARDING_EXPERIMENT.FLAG_KEY]: 'commit_first',
    });

    await expect(resolveOnboardingVariant()).resolves.toBe('commit_first');
    expect(useExperimentStore.getState().source).toBe('posthog');
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      '$feature_flag_called',
      expect.objectContaining({
        $feature_flag: ONBOARDING_EXPERIMENT.FLAG_KEY,
        $feature_flag_response: 'commit_first',
        locally_defaulted: false,
      }),
    );
    expect(mockPosthog.register).toHaveBeenCalledWith({ onboarding_variant: 'commit_first' });
  });

  it('a disabled or unknown flag value is the kill switch: garage_first, source fallback', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({
      [ONBOARDING_EXPERIMENT.FLAG_KEY]: false,
    });

    await expect(resolveOnboardingVariant()).resolves.toBe('garage_first');
    expect(useExperimentStore.getState().source).toBe('fallback');
  });

  it('a flag fetch that times out assigns locally with a 50/50 draw', async () => {
    jest.useFakeTimers();
    mockPosthog.reloadFeatureFlagsAsync.mockReturnValue(new Promise(() => {}));
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.9);

    const pending = resolveOnboardingVariant();
    jest.advanceTimersByTime(ONBOARDING_EXPERIMENT.FLAG_FETCH_TIMEOUT_MS + 1);

    await expect(pending).resolves.toBe('commit_first');
    expect(useExperimentStore.getState().source).toBe('local');
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      '$feature_flag_called',
      expect.objectContaining({ locally_defaulted: true }),
    );
    random.mockRestore();
  });

  it('with analytics off (pre-consent EEA) assigns locally without asking PostHog', async () => {
    mockAnalyticsEnabled = false;
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.1);

    await expect(resolveOnboardingVariant()).resolves.toBe('garage_first');
    expect(useExperimentStore.getState().source).toBe('local');
    expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
    expect(mockPosthog.capture).not.toHaveBeenCalled();

    useExperimentStore.getState().reset();
    random.mockReturnValue(0.6);
    await expect(resolveOnboardingVariant()).resolves.toBe('commit_first');
    random.mockRestore();
  });

  it('concurrent first-launch calls share one flag fetch', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({
      [ONBOARDING_EXPERIMENT.FLAG_KEY]: 'garage_first',
    });

    const [a, b] = await Promise.all([resolveOnboardingVariant(), resolveOnboardingVariant()]);
    expect(a).toBe('garage_first');
    expect(b).toBe('garage_first');
    expect(mockPosthog.reloadFeatureFlagsAsync).toHaveBeenCalledTimes(1);
  });

  it('a persisted shipped install is returned untouched, with no flag fetch', async () => {
    useExperimentStore.getState().assignVariant(OB_VARIANT.SHIPPED, 'shipped');

    await expect(resolveOnboardingVariant()).resolves.toBe('shipped');
    expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
  });
});
