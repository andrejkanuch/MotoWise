// Onboarding A/B (2026) — variant assignment, flow config, analytics parity.

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

// Controllable PostHog client for the experiment resolver.
const mockPosthog = {
  reloadFeatureFlagsAsync: jest.fn(),
  getFeatureFlag: jest.fn(),
  register: jest.fn(),
  capture: jest.fn(),
};
const mockTrackEvent = jest.fn();
const mockSetUserProperties = jest.fn();
let mockAnalyticsEnabled = true;

jest.mock('../lib/analytics', () => ({
  AnalyticsEvent: {
    ONBOARDING_STEP_VIEWED: 'onboarding_step_viewed',
    ONBOARDING_STEP_COMPLETED: 'onboarding_step_completed',
    ONBOARDING_STARTED: 'onboarding_started',
    BIKE_ADDED: 'bike_added',
  },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  posthogClient: mockPosthog,
  isAnalyticsEnabled: () => mockAnalyticsEnabled,
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  OB_VARIANT,
  OB_SCREEN,
  isObVariant,
  getFlowScreens,
  getTotalScreens,
  getStepIndex,
  getNextRoute,
  getResumeRoute,
  getPreviousRoute,
  getPrimaryConcern,
} = require('../config/onboarding');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useExperimentStore } = require('../stores/experiment.store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveOnboardingVariant, getOnboardingVariant } = require('../lib/onboarding-experiment');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trackOnboardingEvent } = require('../lib/onboarding-analytics');

beforeEach(() => {
  useExperimentStore.getState().reset();
  jest.clearAllMocks();
  mockAnalyticsEnabled = true;
});

describe('isObVariant', () => {
  it('accepts known variants and rejects everything else', () => {
    expect(isObVariant('lean')).toBe(true);
    expect(isObVariant('invested')).toBe(true);
    expect(isObVariant('control')).toBe(true);
    expect(isObVariant('bogus')).toBe(false);
    expect(isObVariant(undefined)).toBe(false);
    expect(isObVariant(null)).toBe(false);
  });
});

describe('variant flow config', () => {
  it('control flow matches the pre-test V4 order', () => {
    expect(getFlowScreens(OB_VARIANT.CONTROL)).toEqual([
      OB_SCREEN.WELCOME,
      OB_SCREEN.EXPERIENCE,
      OB_SCREEN.GOALS,
      OB_SCREEN.BIKE_SETUP,
      OB_SCREEN.MAINTENANCE,
      OB_SCREEN.PAYWALL,
      OB_SCREEN.HEARD_ABOUT,
      OB_SCREEN.NOTIFICATIONS,
      OB_SCREEN.PERSONALIZING,
    ]);
  });

  it('lean puts the bike first then pays it off with the reveal', () => {
    const lean = getFlowScreens(OB_VARIANT.LEAN);
    expect(lean.indexOf(OB_SCREEN.BIKE_SETUP)).toBeLessThan(lean.indexOf(OB_SCREEN.REVEAL));
    expect(lean.indexOf(OB_SCREEN.REVEAL)).toBeLessThan(lean.indexOf(OB_SCREEN.GOALS));
    expect(lean.indexOf(OB_SCREEN.COMMITMENT)).toBeLessThan(lean.indexOf(OB_SCREEN.PAYWALL));
    expect(lean.indexOf(OB_SCREEN.ACCOUNT)).toBeGreaterThan(lean.indexOf(OB_SCREEN.PAYWALL));
  });

  it('invested adds the profiling steps + loader and is longer than lean', () => {
    const invested = getFlowScreens(OB_VARIANT.INVESTED);
    expect(invested).toContain(OB_SCREEN.FREQUENCY);
    expect(invested).toContain(OB_SCREEN.STAY_ON_TOP);
    expect(invested).toContain(OB_SCREEN.LAST_SERVICE);
    expect(invested).toContain(OB_SCREEN.BUILDING_PLAN);
    expect(getTotalScreens(OB_VARIANT.INVESTED)).toBeGreaterThan(getTotalScreens(OB_VARIANT.LEAN));
    // building-plan sits right before the reveal
    expect(invested.indexOf(OB_SCREEN.BUILDING_PLAN)).toBe(invested.indexOf(OB_SCREEN.REVEAL) - 1);
  });

  it('step index is variant-relative (same screen, different position)', () => {
    // goals is index 2 in control but later in lean (after bike + reveal)
    expect(getStepIndex(OB_VARIANT.CONTROL, OB_SCREEN.GOALS)).toBe(2);
    expect(getStepIndex(OB_VARIANT.LEAN, OB_SCREEN.GOALS)).toBe(4);
  });

  it('no-bike branch (§4): lean skips reveal/maintenance/commitment', () => {
    const noBike = { hasBike: false };
    // bike-setup skip routes around reveal → goals
    expect(getNextRoute(OB_VARIANT.LEAN, OB_SCREEN.BIKE_SETUP, noBike)).toBe('/(onboarding)/goals');
    // goals with no bike jumps past maintenance + commitment → paywall
    expect(getNextRoute(OB_VARIANT.LEAN, OB_SCREEN.GOALS, noBike)).toBe('/(onboarding)/paywall');
    // with a bike, the normal flow is preserved
    expect(getNextRoute(OB_VARIANT.LEAN, OB_SCREEN.BIKE_SETUP, { hasBike: true })).toBe(
      '/(onboarding)/reveal',
    );
    expect(getNextRoute(OB_VARIANT.LEAN, OB_SCREEN.GOALS, { hasBike: true })).toBe(
      '/(onboarding)/maintenance',
    );
    // control is the untouched V4 flow — the branch never applies
    expect(getNextRoute(OB_VARIANT.CONTROL, OB_SCREEN.GOALS, noBike)).toBe(
      getNextRoute(OB_VARIANT.CONTROL, OB_SCREEN.GOALS),
    );
  });

  it('next / resume / previous walk the active variant flow', () => {
    expect(getNextRoute(OB_VARIANT.LEAN, OB_SCREEN.BIKE_SETUP)).toBe('/(onboarding)/reveal');
    expect(getResumeRoute(OB_VARIANT.LEAN, OB_SCREEN.REVEAL)).toBe('/(onboarding)/goals');
    expect(getPreviousRoute(OB_VARIANT.INVESTED, OB_SCREEN.STAY_ON_TOP)).toBe(
      '/(onboarding)/frequency',
    );
    expect(getNextRoute(OB_VARIANT.LEAN, OB_SCREEN.PERSONALIZING)).toBeNull();
  });

  it('Back from the Reveal skips the building-plan loader (no re-loop)', () => {
    // building-plan auto-advances to reveal; Back must skip past it to the
    // previous real step (bike-setup), or the loader re-runs and bounces the
    // user forward again — the building-plan↔reveal loop.
    expect(getPreviousRoute(OB_VARIANT.INVESTED, OB_SCREEN.REVEAL)).toBe(
      '/(onboarding)/bike-setup',
    );
  });

  it('Back to the welcome step targets the group root, not /index (404 guard)', () => {
    // The welcome screen is the (onboarding) group's index file; its href is the
    // group root. `/(onboarding)/index` is not a real route and renders "Page
    // not found", which Back used to hit when falling through to welcome.
    expect(getPreviousRoute(OB_VARIANT.LEAN, OB_SCREEN.EXPERIENCE)).toBe('/(onboarding)');
    expect(getPreviousRoute(OB_VARIANT.INVESTED, OB_SCREEN.EXPERIENCE)).toBe('/(onboarding)');
  });
});

describe('getPrimaryConcern', () => {
  it('returns the highest-priority concern regardless of selection order', () => {
    // costs outranks issues even when issues was tapped first
    expect(getPrimaryConcern(['catch_issues_early', 'avoid_surprise_costs'])).toBe(
      'avoid_surprise_costs',
    );
    expect(getPrimaryConcern(['keep_resale_value', 'catch_issues_early'])).toBe(
      'catch_issues_early',
    );
  });

  it('falls back to the casual concern when nothing maps', () => {
    expect(getPrimaryConcern([])).toBe('just_enjoy');
    expect(getPrimaryConcern(['unknown'])).toBe('just_enjoy');
  });
});

describe('resolveOnboardingVariant', () => {
  it('assigns from the PostHog flag and persists it', async () => {
    // Variant is read from the resolved flags map (not getFeatureFlag), so no
    // auto $feature_flag_called fires before the super property is registered.
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({ onboarding_ab_2026: 'invested' });

    const variant = await resolveOnboardingVariant();

    expect(variant).toBe('invested');
    expect(useExperimentStore.getState().onboardingVariant).toBe('invested');
    expect(useExperimentStore.getState().source).toBe('posthog');
    expect(mockPosthog.register).toHaveBeenCalledWith({ onboarding_variant: 'invested' });
    // Exposure is emitted manually (after register) on the happy path too.
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      '$feature_flag_called',
      expect.objectContaining({
        $feature_flag_response: 'invested',
        onboarding_variant: 'invested',
        locally_defaulted: false,
      }),
    );
  });

  it('falls back to lean when the flag fetch fails (offline)', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockRejectedValue(new Error('offline'));

    const variant = await resolveOnboardingVariant();

    expect(variant).toBe('lean');
    expect(useExperimentStore.getState().source).toBe('fallback');
    // Manual exposure event recorded for the locally-defaulted user.
    expect(mockPosthog.capture).toHaveBeenCalledWith(
      '$feature_flag_called',
      expect.objectContaining({ locally_defaulted: true, $feature_flag_response: 'lean' }),
    );
  });

  it('maps a disabled/unknown flag value to control (V4 kill switch)', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({ onboarding_ab_2026: false });

    expect(await resolveOnboardingVariant()).toBe('control');
  });

  it('never re-rolls once assigned (sticky across calls)', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({ onboarding_ab_2026: 'lean' });
    await resolveOnboardingVariant();

    // A later evaluation returns a different value — assignment must not change.
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({ onboarding_ab_2026: 'invested' });
    const second = await resolveOnboardingVariant();

    expect(second).toBe('lean');
    expect(mockPosthog.reloadFeatureFlagsAsync).toHaveBeenCalledTimes(1);
  });

  it('dev EXPO_PUBLIC_OB_VARIANT override forces the arm without touching the network', async () => {
    process.env.EXPO_PUBLIC_OB_VARIANT = 'invested';
    try {
      // Even if the flag would resolve to lean, the dev override wins.
      mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({ onboarding_ab_2026: 'lean' });

      const variant = await resolveOnboardingVariant();

      expect(variant).toBe('invested');
      expect(useExperimentStore.getState().source).toBe('override');
      expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_OB_VARIANT;
    }
  });

  it('getOnboardingVariant returns control before assignment', () => {
    expect(getOnboardingVariant()).toBe('control');
  });
});

describe('trackOnboardingEvent parity', () => {
  it('attaches variant, step, and step_index to every onboarding event', async () => {
    mockPosthog.reloadFeatureFlagsAsync.mockResolvedValue({ onboarding_ab_2026: 'lean' });
    await resolveOnboardingVariant();

    trackOnboardingEvent('onboarding_step_viewed', OB_SCREEN.REVEAL, { foo: 'bar' });

    expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_step_viewed', {
      variant: 'lean',
      step: 'reveal',
      step_index: getStepIndex(OB_VARIANT.LEAN, OB_SCREEN.REVEAL),
      foo: 'bar',
    });
  });
});
