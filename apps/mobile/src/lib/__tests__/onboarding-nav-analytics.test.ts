// Issue 365 T04b — onboarding navigation, resume and gate events: one fire per
// action, typed properties, `gate_routed` once per cold start, and a v9
// persisted onboarding state still loading after the new fields.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  // The five names under test are their keys lowercased.
  AnalyticsEvent: new Proxy({}, { get: (_t, p) => String(p).toLowerCase() }),
}));
jest.mock('../onboarding-experiment', () => ({ getOnboardingVariant: () => 'shipped' }));

import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { markOnboardingButtonBack } from '../onboarding-back-marker';
import {
  GATE_GROUP,
  type GateRoutedInput,
  ONBOARDING_BACK_EXIT,
  ONBOARDING_BACK_TRIGGER,
  ONBOARDING_COMPLETED_SOURCE,
  onboardingResumeContext,
  onboardingScreenListeners,
  onOnboardingBeforeRemove,
  onOnboardingHardwareBack,
  readWelcomeMount,
  recordOnboardingFocus,
  resetOnboardingNavAnalyticsForTests,
  resolveGateGroup,
  trackAuthSessionLost,
  trackGateRoutedOnce,
  trackOnboardingReplaceBack,
  trackWelcomeMounted,
  WELCOME_MOUNT_REASON,
  welcomeMountReason,
} from '../onboarding-nav-analytics';

const T0 = 1_800_000_000_000;

function calls(event: string) {
  return mockTrackEvent.mock.calls.filter(([name]) => name === event).map(([, props]) => props);
}

beforeEach(() => {
  mockTrackEvent.mockClear();
  resetOnboardingNavAnalyticsForTests();
  useOnboardingStore.getState().reset();
});

describe('onboarding_back', () => {
  it('hardware back (GO_BACK): one event with step names and time on screen', () => {
    recordOnboardingFocus(OB_SCREEN.ACCOUNT, 4, T0);
    onOnboardingBeforeRemove('GO_BACK', OB_SCREEN.ACCOUNT, OB_SCREEN.GOALS, T0 + 1200);
    expect(calls('onboarding_back')).toEqual([
      {
        variant: 'shipped',
        from: 'account',
        to: 'goals',
        trigger: ONBOARDING_BACK_TRIGGER.HARDWARE,
        ms_on_screen: 1200,
      },
    ]);
  });

  it('three quick hardware backs give three events under 5 s each', () => {
    const path = [OB_SCREEN.ACCOUNT, OB_SCREEN.GOALS, OB_SCREEN.BIKE_SETUP, OB_SCREEN.EXPERIENCE];
    let now = T0;
    recordOnboardingFocus(path[0], 3, now);
    for (let i = 0; i < 3; i++) {
      now += 800;
      onOnboardingBeforeRemove('GO_BACK', path[i], path[i + 1], now);
      recordOnboardingFocus(path[i + 1], 2 - i, now);
    }
    const events = calls('onboarding_back');
    expect(events).toHaveLength(3);
    for (const e of events) {
      expect(e).toMatchObject({ trigger: 'hardware', ms_on_screen: 800 });
    }
  });

  it('a POP is the iOS swipe', () => {
    onOnboardingBeforeRemove('POP', OB_SCREEN.GOALS, OB_SCREEN.BIKE_SETUP, T0);
    expect(calls('onboarding_back')).toEqual([
      expect.objectContaining({ trigger: ONBOARDING_BACK_TRIGGER.GESTURE, ms_on_screen: null }),
    ]);
  });

  it('a marked chevron press claims the GO_BACK that follows, once', () => {
    markOnboardingButtonBack(T0);
    onOnboardingBeforeRemove('GO_BACK', OB_SCREEN.GOALS, OB_SCREEN.BIKE_SETUP, T0 + 5);
    onOnboardingBeforeRemove('GO_BACK', OB_SCREEN.BIKE_SETUP, OB_SCREEN.EXPERIENCE, T0 + 900);
    expect(calls('onboarding_back').map((e) => e.trigger)).toEqual(['button', 'hardware']);
  });

  it('forward replaces, resets and a missing screen below are not backs', () => {
    onOnboardingBeforeRemove('REPLACE', OB_SCREEN.GOALS, OB_SCREEN.BIKE_SETUP, T0);
    onOnboardingBeforeRemove('RESET', OB_SCREEN.GOALS, OB_SCREEN.BIKE_SETUP, T0);
    onOnboardingBeforeRemove('GO_BACK', OB_SCREEN.EXPERIENCE, null, T0);
    expect(calls('onboarding_back')).toEqual([]);
  });

  it('hardware back on the stack root records the exit and never consumes the press', () => {
    recordOnboardingFocus(OB_SCREEN.ACCOUNT, 0, T0);
    expect(onOnboardingHardwareBack(T0 + 300)).toBe(false);
    expect(calls('onboarding_back')).toEqual([
      expect.objectContaining({ from: 'account', to: ONBOARDING_BACK_EXIT, ms_on_screen: 300 }),
    ]);
  });

  it('hardware back above the root leaves it to beforeRemove', () => {
    recordOnboardingFocus(OB_SCREEN.ACCOUNT, 2, T0);
    expect(onOnboardingHardwareBack(T0)).toBe(false);
    expect(calls('onboarding_back')).toEqual([]);
  });
});

describe('onboarding stack wiring', () => {
  const routes = [
    { key: 'k0', name: OB_SCREEN.WELCOME },
    { key: 'k1', name: OB_SCREEN.EXPERIENCE },
    { key: 'k2', name: OB_SCREEN.BIKE_SETUP },
  ];
  const navigation = { getState: () => ({ routes }) };

  it('screenListeners: focus records the step, a hardware pop reports the screen below', () => {
    const listeners = onboardingScreenListeners({ route: routes[2], navigation });
    listeners.focus();
    expect(useOnboardingStore.getState().lastViewedScreen).toBe('bike-setup');
    listeners.beforeRemove({ data: { action: { type: 'GO_BACK' } } });
    expect(calls('onboarding_back')).toEqual([
      expect.objectContaining({ from: 'bike_setup', to: 'experience', trigger: 'hardware' }),
    ]);
  });

  it('screenListeners: a forward replace is not a back', () => {
    onboardingScreenListeners({ route: routes[2], navigation }).beforeRemove({
      data: { action: { type: 'REPLACE' } },
    });
    expect(calls('onboarding_back')).toEqual([]);
  });

  it('the chevron replace fallback reports the step it goes to, as button', () => {
    trackOnboardingReplaceBack(OB_SCREEN.ACCOUNT, '/(onboarding)/goals', T0);
    trackOnboardingReplaceBack(OB_SCREEN.EXPERIENCE, '/(onboarding)', T0);
    expect(calls('onboarding_back')).toEqual([
      expect.objectContaining({ from: 'account', to: 'goals', trigger: 'button' }),
      expect.objectContaining({ from: 'experience', to: 'welcome', trigger: 'button' }),
    ]);
  });
});

describe('last viewed step (persisted for onboarding_resumed)', () => {
  it('every focus records the step and the time and ends a pending code step', () => {
    recordOnboardingFocus(OB_SCREEN.ACCOUNT, 3, T0);
    useOnboardingStore.getState().setCodeStepPending(true);
    expect(useOnboardingStore.getState()).toMatchObject({
      lastViewedScreen: 'account',
      lastViewedAt: T0,
      codeStepPending: true,
    });
    recordOnboardingFocus(OB_SCREEN.NOTIFICATIONS, 4, T0 + 10);
    expect(useOnboardingStore.getState().codeStepPending).toBe(false);
  });

  it('a code step outside an onboarding run is not recorded', () => {
    useOnboardingStore.getState().setCodeStepPending(true);
    expect(useOnboardingStore.getState().codeStepPending).toBe(false);
  });

  it('resume context: screen, seconds away, code step and session as 0/1', () => {
    recordOnboardingFocus(OB_SCREEN.ACCOUNT, 3, T0);
    useOnboardingStore.getState().setCodeStepPending(true);
    expect(onboardingResumeContext(true, false, T0 + 65_400)).toEqual({
      resumed_from_screen: 'account',
      away_s: 65,
      cold_start: true,
      pending_code_step: 1,
      had_session: 0,
    });
  });

  it('a state from before the field existed resumes with nulls', () => {
    expect(onboardingResumeContext(true, true, T0)).toEqual({
      resumed_from_screen: null,
      away_s: null,
      cold_start: true,
      pending_code_step: 0,
      had_session: 1,
    });
  });
});

describe('onboarding_welcome_mounted', () => {
  it('first mount in a runtime is initial', () => {
    expect(welcomeMountReason(false, T0)).toBe(WELCOME_MOUNT_REASON.INITIAL);
  });

  it('a mount right after a Back to Welcome is back; otherwise remount', () => {
    onOnboardingBeforeRemove('GO_BACK', OB_SCREEN.EXPERIENCE, OB_SCREEN.WELCOME, T0);
    expect(welcomeMountReason(true, T0 + 100)).toBe(WELCOME_MOUNT_REASON.BACK);
    expect(welcomeMountReason(true, T0 + 60_000)).toBe(WELCOME_MOUNT_REASON.REMOUNT);
  });

  it('had_progress is any step past Welcome on record', () => {
    trackWelcomeMounted(readWelcomeMount(false, T0));
    recordOnboardingFocus(OB_SCREEN.WELCOME, 0, T0);
    trackWelcomeMounted(readWelcomeMount(true, T0));
    recordOnboardingFocus(OB_SCREEN.BIKE_SETUP, 2, T0);
    trackWelcomeMounted(readWelcomeMount(true, T0));
    expect(calls('onboarding_welcome_mounted')).toEqual([
      { variant: 'shipped', reason: 'initial', had_progress: false },
      { variant: 'shipped', reason: 'remount', had_progress: false },
      { variant: 'shipped', reason: 'remount', had_progress: true },
    ]);
  });

  it('a completed step counts as progress', () => {
    useOnboardingStore.getState().setLastCompletedScreen(OB_SCREEN.EXPERIENCE);
    expect(readWelcomeMount(true, T0).hadProgress).toBe(true);
  });
});

describe('gate_routed', () => {
  // This JS runtime started 10 s before T0; `me` below is from the last launch.
  const LAUNCH = T0 - 10_000;
  const base: GateRoutedInput = {
    group: GATE_GROUP.TABS,
    storeOnboardingCompleted: false,
    hasMe: true,
    meUpdatedAt: T0 - 90_000,
  };

  beforeEach(() => resetOnboardingNavAnalyticsForTests(LAUNCH));

  it('fires once per cold start, with the source and the age of `me`', () => {
    expect(trackGateRoutedOnce(base, T0)).toBe(true);
    expect(trackGateRoutedOnce({ ...base, group: GATE_GROUP.ONBOARDING }, T0 + 1)).toBe(false);
    expect(calls('gate_routed')).toEqual([
      { group: 'tabs', onboarding_completed_source: 'me_cache', me_age_s: 90 },
    ]);
  });

  it('a new JS runtime (cold start) fires again', () => {
    trackGateRoutedOnce(base, T0);
    jest.isolateModules(() => {
      const fresh = require('../onboarding-nav-analytics');
      fresh.resetOnboardingNavAnalyticsForTests(LAUNCH);
      expect(fresh.trackGateRoutedOnce(base, T0)).toBe(true);
    });
    expect(calls('gate_routed')).toHaveLength(2);
  });

  it.each([
    [{ storeOnboardingCompleted: true }, ONBOARDING_COMPLETED_SOURCE.LOCAL],
    [{ meUpdatedAt: LAUNCH + 5_000 }, ONBOARDING_COMPLETED_SOURCE.ME_NETWORK],
    [{ meUpdatedAt: LAUNCH }, ONBOARDING_COMPLETED_SOURCE.ME_NETWORK],
    [{}, ONBOARDING_COMPLETED_SOURCE.ME_CACHE],
    [{ meUpdatedAt: LAUNCH - 1 }, ONBOARDING_COMPLETED_SOURCE.ME_CACHE],
    [{ hasMe: false, meUpdatedAt: 0 }, ONBOARDING_COMPLETED_SOURCE.NONE],
  ])('source for %o is %s', (override, source) => {
    trackGateRoutedOnce({ ...base, ...override }, T0);
    expect(calls('gate_routed')[0].onboarding_completed_source).toBe(source);
  });

  it('no `me` means no age', () => {
    trackGateRoutedOnce({ ...base, hasMe: false, meUpdatedAt: 0 }, T0);
    expect(calls('gate_routed')[0].me_age_s).toBeNull();
  });

  it('group follows the gate order', () => {
    const none = { restoring: false, auth: false, onboarding: false, tabs: false };
    expect(resolveGateGroup({ ...none, restoring: true, auth: true })).toBe('restoring');
    expect(resolveGateGroup({ ...none, auth: true })).toBe('auth');
    expect(resolveGateGroup({ ...none, onboarding: true })).toBe('onboarding');
    expect(resolveGateGroup({ ...none, tabs: true })).toBe('tabs');
    expect(resolveGateGroup(none)).toBe('none');
  });
});

describe('auth_session_lost', () => {
  it('mid-onboarding: reports the last step', () => {
    recordOnboardingFocus(OB_SCREEN.NOTIFICATIONS, 5, T0);
    trackAuthSessionLost('SIGNED_OUT');
    expect(calls('auth_session_lost')).toEqual([
      { during_onboarding: true, last_step: 'notifications', auth_event: 'SIGNED_OUT' },
    ]);
  });

  it('signed in from the onboarding sign-in step, then signed out: not mid-onboarding', () => {
    recordOnboardingFocus(OB_SCREEN.WELCOME, 0, T0);
    recordOnboardingFocus(OB_SCREEN.SIGN_IN, 1, T0 + 1_000);
    // The gate opens (tabs) for the returning rider; personalizing never runs.
    useOnboardingStore.getState().clearResumePoint();
    trackAuthSessionLost('SIGNED_OUT');
    expect(calls('auth_session_lost')).toEqual([
      { during_onboarding: false, last_step: null, auth_event: 'SIGNED_OUT' },
    ]);
  });

  it('outside onboarding: no step', () => {
    trackAuthSessionLost('INITIAL_SESSION');
    expect(calls('auth_session_lost')).toEqual([
      { during_onboarding: false, last_step: null, auth_event: 'INITIAL_SESSION' },
    ]);
  });
});

describe('persisted onboarding state', () => {
  it('a v9 state without the new fields loads unchanged and takes the defaults', async () => {
    const mmkv = require('react-native-mmkv').__store as Map<string, string>;
    mmkv.set(
      'onboarding-state',
      JSON.stringify({
        version: 9,
        state: { lastCompletedScreen: 'bike-setup', ridingGoals: ['track_rides'] },
      }),
    );
    await useOnboardingStore.persist.rehydrate();
    expect(useOnboardingStore.getState()).toMatchObject({
      lastCompletedScreen: 'bike-setup',
      ridingGoals: ['track_rides'],
      lastViewedScreen: null,
      lastViewedAt: null,
      codeStepPending: false,
    });
  });
});
