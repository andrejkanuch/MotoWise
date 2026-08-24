// Onboarding flow config + variant resolution, AFTER the 2026-08-24 retirement
// of the A/B experiment (PostHog 83476) and the removal of the paywall,
// maintenance and scan-receipt steps.
//
// The point of this file is no longer "do the three arms differ" — they do not,
// by design. It is: one flow ships, the three legacy variant values still work
// for the ~423 installs that persisted one, and nobody resumes into a dead end.

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
  isRetiredScreen,
  getFlowScreens,
  getTotalScreens,
  getStepIndex,
  getNextRoute,
  getResumeRoute,
  getPreviousRoute,
  getPrimaryConcern,
  ONBOARDING_FLOWS,
  OB_STEP_NAME,
} = require('../config/onboarding');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useExperimentStore } = require('../stores/experiment.store');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resolveOnboardingVariant, getOnboardingVariant } = require('../lib/onboarding-experiment');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { trackOnboardingEvent } = require('../lib/onboarding-analytics');

/** Every value that can be persisted in MMKV, including the retired arms. */
const ALL_VARIANTS = [OB_VARIANT.SHIPPED, OB_VARIANT.LEAN, OB_VARIANT.INVESTED, OB_VARIANT.CONTROL];
const LEGACY_VARIANTS = [OB_VARIANT.LEAN, OB_VARIANT.INVESTED, OB_VARIANT.CONTROL];

beforeEach(() => {
  useExperimentStore.getState().reset();
  jest.clearAllMocks();
  mockAnalyticsEnabled = true;
});

describe('isObVariant', () => {
  it('accepts the shipped value and the retired arms, rejects everything else', () => {
    // The retired arms must stay valid: rejecting them would make ~423 persisted
    // MMKV records fail to parse and re-roll riders mid-onboarding.
    expect(isObVariant('shipped')).toBe(true);
    expect(isObVariant('lean')).toBe(true);
    expect(isObVariant('invested')).toBe(true);
    expect(isObVariant('control')).toBe(true);
    expect(isObVariant('bogus')).toBe(false);
    expect(isObVariant(undefined)).toBe(false);
    expect(isObVariant(null)).toBe(false);
  });
});

describe('one flow ships', () => {
  it('is exactly the 11 shipped screens, in order', () => {
    expect(getFlowScreens(OB_VARIANT.SHIPPED)).toEqual([
      OB_SCREEN.WELCOME,
      OB_SCREEN.EXPERIENCE,
      OB_SCREEN.BIKE_SETUP,
      OB_SCREEN.REVEAL,
      OB_SCREEN.NO_BIKE_VALUE,
      OB_SCREEN.GOALS,
      OB_SCREEN.COMMITMENT,
      OB_SCREEN.ACCOUNT,
      OB_SCREEN.HEARD_ABOUT,
      OB_SCREEN.NOTIFICATIONS,
      OB_SCREEN.PERSONALIZING,
    ]);
    expect(getTotalScreens(OB_VARIANT.SHIPPED)).toBe(11);
  });

  it('every variant value — including the retired arms — resolves to that same flow', () => {
    // This IS the "no reset, no stranding" guarantee. A rider holding `invested`
    // must not hit an undefined flow lookup.
    for (const variant of ALL_VARIANTS) {
      expect(getFlowScreens(variant)).toEqual(getFlowScreens(OB_VARIANT.SHIPPED));
      expect(getTotalScreens(variant)).toBe(11);
    }
  });

  it('contains no paywall, maintenance, or scan-receipt step (R3, R4)', () => {
    for (const variant of ALL_VARIANTS) {
      const flow = getFlowScreens(variant);
      expect(flow).not.toContain(OB_SCREEN.PAYWALL);
      expect(flow).not.toContain(OB_SCREEN.MAINTENANCE);
      expect(flow).not.toContain(OB_SCREEN.SCAN_RECEIPT);
    }
  });

  it('contains none of the four invested-only screens', () => {
    for (const variant of ALL_VARIANTS) {
      const flow = getFlowScreens(variant);
      for (const screen of [
        OB_SCREEN.FREQUENCY,
        OB_SCREEN.STAY_ON_TOP,
        OB_SCREEN.LAST_SERVICE,
        OB_SCREEN.BUILDING_PLAN,
      ]) {
        expect(flow).not.toContain(screen);
      }
    }
  });

  it('keeps heard-about, the only working install-attribution signal', () => {
    const flow = getFlowScreens(OB_VARIANT.SHIPPED);
    expect(flow).toContain(OB_SCREEN.HEARD_ABOUT);
    // Contract preserved from the A/B era: account → heard-about → notifications.
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.ACCOUNT)).toBe('/(onboarding)/heard-about');
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.HEARD_ABOUT)).toBe(
      '/(onboarding)/notifications',
    );
  });

  it('step indices are contiguous and start at 0 after the removals', () => {
    const flow = getFlowScreens(OB_VARIANT.SHIPPED);
    const indices = flow.map((s: string) => getStepIndex(OB_VARIANT.SHIPPED, s));
    expect(indices).toEqual([...flow.keys()]);
  });

  it('a rider walking the whole flow never reaches a paywall', () => {
    // Walk it for real rather than asserting on the array: this catches a
    // paywall reachable via next-route resolution even if it is not a member.
    const visited: string[] = [];
    let current = OB_SCREEN.WELCOME;
    for (let i = 0; i < 30; i++) {
      visited.push(current);
      const next = getNextRoute(OB_VARIANT.SHIPPED, current, { hasBike: true });
      if (!next) break;
      current = next.replace('/(onboarding)/', '') || OB_SCREEN.WELCOME;
    }
    expect(visited).not.toContain(OB_SCREEN.PAYWALL);
    expect(visited[visited.length - 1]).toBe(OB_SCREEN.PERSONALIZING);
  });
});

describe('bike-state branching', () => {
  const noBike = { hasBike: false };
  const withBike = { hasBike: true };

  it('a skipper gets the no-bike value screen, an owner gets the reveal', () => {
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.BIKE_SETUP, noBike)).toBe(
      '/(onboarding)/no-bike-value',
    );
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.BIKE_SETUP, withBike)).toBe(
      '/(onboarding)/reveal',
    );
  });

  it('a bike-less rider skips the commitment and lands on the account step', () => {
    // maintenance used to sit between goals and commitment; with it gone, and
    // commitment still bike-dependent, goals now leads straight to account.
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.NO_BIKE_VALUE, noBike)).toBe(
      '/(onboarding)/goals',
    );
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.GOALS, noBike)).toBe('/(onboarding)/account');
  });

  it('a bike owner goes reveal → goals → commitment', () => {
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.REVEAL, withBike)).toBe(
      '/(onboarding)/goals',
    );
    expect(getNextRoute(OB_VARIANT.SHIPPED, OB_SCREEN.GOALS, withBike)).toBe(
      '/(onboarding)/commitment',
    );
  });

  it('applies to a persisted `control` rider too (the exemption is gone)', () => {
    // control used to be exempt from bike-state routing because it was the V4
    // flow and had no reveal. It now resolves to the shipped flow, so exempting
    // it would march a bike-less rider straight into a Reveal with no bike.
    for (const variant of LEGACY_VARIANTS) {
      expect(getNextRoute(variant, OB_SCREEN.BIKE_SETUP, noBike)).toBe(
        '/(onboarding)/no-bike-value',
      );
    }
  });
});

describe('retired screens resolve forward, never into a dead end', () => {
  it('marks exactly the seven retired screens', () => {
    for (const screen of [
      OB_SCREEN.PAYWALL,
      OB_SCREEN.MAINTENANCE,
      OB_SCREEN.SCAN_RECEIPT,
      OB_SCREEN.FREQUENCY,
      OB_SCREEN.STAY_ON_TOP,
      OB_SCREEN.LAST_SERVICE,
      OB_SCREEN.BUILDING_PLAN,
    ]) {
      expect(isRetiredScreen(screen)).toBe(true);
    }
    for (const screen of getFlowScreens(OB_VARIANT.SHIPPED)) {
      expect(isRetiredScreen(screen)).toBe(false);
    }
  });

  // This is the OTA-day scenario: a rider paused mid-flow on a build that still
  // had these steps. Their persisted lastCompletedScreen is a screen that no
  // longer exists in any flow.
  it.each([
    [OB_SCREEN.PAYWALL, '/(onboarding)/account'],
    [OB_SCREEN.MAINTENANCE, '/(onboarding)/commitment'],
    [OB_SCREEN.SCAN_RECEIPT, '/(onboarding)/personalizing'],
    [OB_SCREEN.FREQUENCY, '/(onboarding)/bike-setup'],
    [OB_SCREEN.STAY_ON_TOP, '/(onboarding)/bike-setup'],
    [OB_SCREEN.LAST_SERVICE, '/(onboarding)/bike-setup'],
    [OB_SCREEN.BUILDING_PLAN, '/(onboarding)/reveal'],
  ])('resuming from the retired %s lands on %s', (retired, expected) => {
    expect(getResumeRoute(OB_VARIANT.SHIPPED, retired, { hasBike: true })).toBe(expected);
  });

  it('resolves for every legacy variant, not just the shipped one', () => {
    for (const variant of LEGACY_VARIANTS) {
      expect(getResumeRoute(variant, OB_SCREEN.PAYWALL, { hasBike: true })).toBe(
        '/(onboarding)/account',
      );
      expect(getResumeRoute(variant, OB_SCREEN.FREQUENCY, { hasBike: true })).toBe(
        '/(onboarding)/bike-setup',
      );
    }
  });

  it('re-applies bike-state skipping to the successor', () => {
    // maintenance → commitment, but commitment is bike-dependent. A rider who
    // skipped their bike must not be dropped onto it.
    expect(getResumeRoute(OB_VARIANT.SHIPPED, OB_SCREEN.MAINTENANCE, { hasBike: false })).toBe(
      '/(onboarding)/account',
    );
  });

  it('an unknown screen still returns null rather than throwing', () => {
    // Degrades gracefully — e.g. a deep link naming a step that never existed.
    expect(getNextRoute(OB_VARIANT.SHIPPED, 'not-a-screen')).toBeNull();
    expect(getPreviousRoute(OB_VARIANT.SHIPPED, 'not-a-screen')).toBeNull();
  });

  it('Back from a retired screen returns null instead of a bogus target', () => {
    expect(getPreviousRoute(OB_VARIANT.SHIPPED, OB_SCREEN.PAYWALL)).toBeNull();
  });
});

describe('Back navigation', () => {
  it('from the account gate lands on commitment, and never on a removed step', () => {
    // Previously the paywall sat between commitment and account, and Back had to
    // skip it explicitly (AUTO_ADVANCE_SCREENS) or the rider was trapped in a
    // paywall↔account loop. With the paywall gone, commitment is simply previous.
    for (const variant of ALL_VARIANTS) {
      const previous = getPreviousRoute(variant, OB_SCREEN.ACCOUNT);
      expect(previous).toBe('/(onboarding)/commitment');
      expect(previous).not.toBe('/(onboarding)/paywall');
    }
  });

  it('walks the flow backwards contiguously with no skipped steps', () => {
    const flow = getFlowScreens(OB_VARIANT.SHIPPED);
    for (let i = 1; i < flow.length; i++) {
      const expected = i - 1 === 0 ? '/(onboarding)' : `/(onboarding)/${flow[i - 1]}`;
      expect(getPreviousRoute(OB_VARIANT.SHIPPED, flow[i])).toBe(expected);
    }
  });

  it('to the welcome step targets the group root, not /index (404 guard)', () => {
    // The welcome screen is the (onboarding) group's index file; its href is the
    // group root. `/(onboarding)/index` is not a real route and renders "Page
    // not found", which Back used to hit when falling through to welcome.
    for (const variant of ALL_VARIANTS) {
      expect(getPreviousRoute(variant, OB_SCREEN.EXPERIENCE)).toBe('/(onboarding)');
    }
  });

  it('returns null at the first step', () => {
    expect(getPreviousRoute(OB_VARIANT.SHIPPED, OB_SCREEN.WELCOME)).toBeNull();
  });
});

describe('analytics contract survives the retirement', () => {
  it('keeps a step name for every retired screen so historical events resolve', () => {
    // Removing a step from the flow is NOT deleting its event definition. These
    // names are what PostHog funnels filter on.
    for (const screen of [
      OB_SCREEN.PAYWALL,
      OB_SCREEN.MAINTENANCE,
      OB_SCREEN.SCAN_RECEIPT,
      OB_SCREEN.FREQUENCY,
      OB_SCREEN.STAY_ON_TOP,
      OB_SCREEN.LAST_SERVICE,
      OB_SCREEN.BUILDING_PLAN,
    ]) {
      expect(OB_STEP_NAME[screen]).toBeTruthy();
    }
    expect(OB_STEP_NAME[OB_SCREEN.PAYWALL]).toBe('paywall');
    expect(OB_STEP_NAME[OB_SCREEN.SCAN_RECEIPT]).toBe('scan_receipt');
  });

  it('attaches variant, step, and step_index to every onboarding event', async () => {
    await resolveOnboardingVariant();

    trackOnboardingEvent('onboarding_step_viewed', OB_SCREEN.REVEAL, { foo: 'bar' });

    expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_step_viewed', {
      variant: 'shipped',
      step: 'reveal',
      step_index: getStepIndex(OB_VARIANT.SHIPPED, OB_SCREEN.REVEAL),
      foo: 'bar',
    });
  });

  it('still reports the variant of a rider carrying a retired arm', async () => {
    useExperimentStore.getState().assignVariant(OB_VARIANT.INVESTED, 'posthog');

    await resolveOnboardingVariant();
    trackOnboardingEvent('onboarding_step_viewed', OB_SCREEN.REVEAL);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      'onboarding_step_viewed',
      expect.objectContaining({ variant: 'invested' }),
    );
  });
});

describe('getPrimaryConcern', () => {
  it('returns the highest-priority concern regardless of selection order', () => {
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

describe('resolveOnboardingVariant after the retirement', () => {
  it('assigns `shipped` to a new install without touching PostHog', async () => {
    const variant = await resolveOnboardingVariant();

    expect(variant).toBe('shipped');
    expect(useExperimentStore.getState().onboardingVariant).toBe('shipped');
    expect(useExperimentStore.getState().source).toBe('shipped');
    // No flag fetch: there is nothing left to evaluate, so onboarding no longer
    // waits on the network at all.
    expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
  });

  it('stops emitting $feature_flag_called for the stopped experiment', async () => {
    await resolveOnboardingVariant();
    expect(mockPosthog.capture).not.toHaveBeenCalled();
  });

  it('registers onboarding_variant as a super AND person property', async () => {
    await resolveOnboardingVariant();
    expect(mockPosthog.register).toHaveBeenCalledWith({ onboarding_variant: 'shipped' });
    expect(mockSetUserProperties).toHaveBeenCalledWith({ onboarding_variant: 'shipped' });
  });

  it.each(
    LEGACY_VARIANTS,
  )('returns a persisted `%s` untouched — never re-rolls', async (legacy) => {
    useExperimentStore.getState().assignVariant(legacy, 'posthog');

    const variant = await resolveOnboardingVariant();

    expect(variant).toBe(legacy);
    expect(useExperimentStore.getState().onboardingVariant).toBe(legacy);
    // The person property is re-registered, NOT cleared: it is the only record
    // of which flow this rider went through, and retention for the arms has to
    // stay readable retrospectively.
    expect(mockPosthog.register).toHaveBeenCalledWith({ onboarding_variant: legacy });
    expect(mockSetUserProperties).toHaveBeenCalledWith({ onboarding_variant: legacy });
  });

  it('is sticky across repeated calls', async () => {
    const first = await resolveOnboardingVariant();
    const second = await resolveOnboardingVariant();
    expect(second).toBe(first);
    expect(useExperimentStore.getState().source).toBe('shipped');
  });

  it('assigns even when analytics consent is off', async () => {
    // Assignment must not depend on reporting. (Note: this is NOT the
    // explanation for the 33 null-variant users seen in PostHog — those are all
    // on builds 3.8.0/3.9.0/3.3.0, which predate the assignment code. A
    // consent-off user emits no events at all, so cannot appear there.)
    mockAnalyticsEnabled = false;

    const variant = await resolveOnboardingVariant();

    expect(variant).toBe('shipped');
    expect(useExperimentStore.getState().onboardingVariant).toBe('shipped');
    expect(mockPosthog.register).not.toHaveBeenCalled();
  });

  it('dev EXPO_PUBLIC_OB_VARIANT override still forces a legacy arm for QA', async () => {
    process.env.EXPO_PUBLIC_OB_VARIANT = 'invested';
    try {
      const variant = await resolveOnboardingVariant();
      expect(variant).toBe('invested');
      expect(useExperimentStore.getState().source).toBe('override');
      expect(mockPosthog.reloadFeatureFlagsAsync).not.toHaveBeenCalled();
    } finally {
      delete process.env.EXPO_PUBLIC_OB_VARIANT;
    }
  });

  it('getOnboardingVariant degrades to `shipped` before assignment', () => {
    // Not `control`: that value now only exists as legacy history, and defaulting
    // to it would imply a cohort the rider was never in.
    expect(getOnboardingVariant()).toBe('shipped');
  });
});

describe('flow config invariants', () => {
  it('exposes a flow for every declared variant', () => {
    expect(Object.keys(ONBOARDING_FLOWS).sort()).toEqual(ALL_VARIANTS.slice().sort());
  });

  it('has no duplicate screens in the flow', () => {
    const flow = getFlowScreens(OB_VARIANT.SHIPPED);
    expect(new Set(flow).size).toBe(flow.length);
  });

  it('names every flow screen in OB_STEP_NAME', () => {
    for (const screen of getFlowScreens(OB_VARIANT.SHIPPED)) {
      expect(OB_STEP_NAME[screen]).toBeTruthy();
    }
  });
});
