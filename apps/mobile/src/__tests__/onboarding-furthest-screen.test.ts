// issue 365 T13b (FS-OB1c, V4 a5): the resume target is the furthest step the
// rider reached. A back-walk (account -> experience) followed by a step forward
// (bike-setup) used to overwrite `lastCompletedScreen` with an earlier screen, so
// a kill resumed the rider at bike-setup instead of account.
jest.mock('react-native-mmkv', () => require('../test/mocks').makeMmkvMock());
jest.mock('../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: jest.fn(),
  AnalyticsEvent: new Proxy({}, { get: (_t, p) => String(p).toLowerCase() }),
}));
const mockVariant = { current: 'garage_first' };
jest.mock('../lib/onboarding-experiment', () => ({
  getOnboardingVariant: () => mockVariant.current,
}));

import {
  getFlowScreens,
  getResumeTarget,
  OB_SCREEN,
  OB_VARIANT,
  type ObVariant,
  type OnboardingRoute,
} from '../config/onboarding';
import { recordOnboardingFocus } from '../lib/onboarding-nav-analytics';
import { useOnboardingStore } from '../stores/onboarding.store';

const T0 = 1_800_000_000_000;
const ASSIGNABLE: ObVariant[] = [OB_VARIANT.GARAGE_FIRST, OB_VARIANT.COMMIT_FIRST];

function focus(...screens: OnboardingRoute[]) {
  screens.forEach((screen, i) => {
    recordOnboardingFocus(screen, i, T0 + i);
  });
}

function routeOf(screen: OnboardingRoute) {
  return screen === OB_SCREEN.WELCOME ? '/(onboarding)' : `/(onboarding)/${screen}`;
}

beforeEach(() => {
  mockVariant.current = OB_VARIANT.GARAGE_FIRST;
  useOnboardingStore.getState().reset();
});

describe('furthestScreen is monotonic', () => {
  it.each(
    ASSIGNABLE,
  )('%s: account, then experience, then bike-setup -> furthest stays account', (variant) => {
    mockVariant.current = variant;
    focus(
      OB_SCREEN.WELCOME,
      OB_SCREEN.EXPERIENCE,
      OB_SCREEN.BIKE_SETUP,
      OB_SCREEN.GOALS,
      OB_SCREEN.ACCOUNT,
      OB_SCREEN.GOALS,
      OB_SCREEN.EXPERIENCE,
      OB_SCREEN.BIKE_SETUP,
    );

    expect(useOnboardingStore.getState().furthestScreen).toBe(OB_SCREEN.ACCOUNT);
    // lastViewedScreen still tracks the screen on top, for onboarding_resumed.
    expect(useOnboardingStore.getState().lastViewedScreen).toBe(OB_SCREEN.BIKE_SETUP);
  });

  it('rises with every step further into the flow', () => {
    focus(OB_SCREEN.WELCOME, OB_SCREEN.EXPERIENCE);
    expect(useOnboardingStore.getState().furthestScreen).toBe(OB_SCREEN.EXPERIENCE);
    focus(OB_SCREEN.BIKE_SETUP);
    expect(useOnboardingStore.getState().furthestScreen).toBe(OB_SCREEN.BIKE_SETUP);
  });

  it('Welcome and the sign-in screen are not resume points', () => {
    focus(OB_SCREEN.WELCOME, OB_SCREEN.SIGN_IN);
    expect(useOnboardingStore.getState().furthestScreen).toBeNull();
  });

  it('reset() and clearResumePoint() drop it', () => {
    focus(OB_SCREEN.EXPERIENCE, OB_SCREEN.BIKE_SETUP);
    useOnboardingStore.getState().clearResumePoint();
    expect(useOnboardingStore.getState().furthestScreen).toBeNull();

    focus(OB_SCREEN.EXPERIENCE);
    useOnboardingStore.getState().reset();
    expect(useOnboardingStore.getState().furthestScreen).toBeNull();
  });
});

describe('getResumeTarget', () => {
  const withBike = { hasBike: true };

  it('V4 a5: reached account, walked back, completed experience again -> account', () => {
    expect(
      getResumeTarget(
        OB_VARIANT.GARAGE_FIRST,
        { lastCompleted: OB_SCREEN.EXPERIENCE, furthest: OB_SCREEN.ACCOUNT },
        withBike,
      ),
    ).toBe('/(onboarding)/account');
  });

  it('the screen after the last completed one wins when it is further (killed before it drew)', () => {
    expect(
      getResumeTarget(
        OB_VARIANT.GARAGE_FIRST,
        { lastCompleted: OB_SCREEN.GOALS, furthest: OB_SCREEN.GOALS },
        withBike,
      ),
    ).toBe('/(onboarding)/account');
  });

  it('a step viewed but not completed resumes on that step', () => {
    expect(
      getResumeTarget(
        OB_VARIANT.GARAGE_FIRST,
        { lastCompleted: null, furthest: OB_SCREEN.EXPERIENCE },
        withBike,
      ),
    ).toBe('/(onboarding)/experience');
  });

  it('nothing on record -> no resume', () => {
    expect(
      getResumeTarget(OB_VARIANT.GARAGE_FIRST, { lastCompleted: null, furthest: null }, withBike),
    ).toBeNull();
  });

  it('a furthest screen the bike state now routes past resolves forward', () => {
    // Reached the Reveal with a bike, walked back and skipped the bike.
    expect(
      getResumeTarget(
        OB_VARIANT.GARAGE_FIRST,
        { lastCompleted: OB_SCREEN.BIKE_SETUP, furthest: OB_SCREEN.REVEAL },
        { hasBike: false },
      ),
    ).toBe('/(onboarding)/no-bike-value');
  });

  it.each(ASSIGNABLE)('%s: the resume target is never earlier than furthestScreen', (variant) => {
    const flow = getFlowScreens(variant);
    for (const furthest of flow.slice(1)) {
      for (const lastCompleted of [null, ...flow]) {
        const target = getResumeTarget(variant, { lastCompleted, furthest }, withBike);
        const reached = flow.findIndex((screen) => routeOf(screen) === target);
        expect(reached).toBeGreaterThanOrEqual(flow.indexOf(furthest));
      }
    }
  });
});
