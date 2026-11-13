// Issue 365 T04b — `gate_routed` fires once per cold start: not while the gate
// holds the splash, once when it settles, and never again on later renders.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../i18n', () => ({ __esModule: true, default: { changeLanguage: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ measurementSystem: 'metric' }] }));
const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, p) => String(p).toLowerCase() }),
}));
jest.mock('../../lib/onboarding-experiment', () => ({ getOnboardingVariant: () => 'shipped' }));

import { renderHook } from '@testing-library/react-native';
import { AUTH_HYDRATION, type AuthGateInput } from '../../lib/auth-hydration';
import { resetOnboardingNavAnalyticsForTests } from '../../lib/onboarding-nav-analytics';
import { useGateRoutedTracking } from '../use-gate-routed-tracking';

const signedIn: AuthGateInput = {
  isSignedIn: true,
  isAnonOnboarding: false,
  hydration: AUTH_HYDRATION.RESOLVED,
};
const meNetwork = { data: { me: {} }, isFetchedAfterMount: true, dataUpdatedAt: Date.now() };

beforeEach(() => {
  mockTrackEvent.mockClear();
  resetOnboardingNavAnalyticsForTests();
});

it('waits for the gate to settle, then fires once across re-renders', async () => {
  const { rerender } = await renderHook(
    (props: Parameters<typeof useGateRoutedTracking>[0]) => useGateRoutedTracking(props),
    {
      initialProps: {
        holding: true,
        gateInput: signedIn,
        onboardingCompleted: false,
        meQuery: meNetwork,
      },
    },
  );
  expect(mockTrackEvent).not.toHaveBeenCalled();

  await rerender({
    holding: false,
    gateInput: signedIn,
    onboardingCompleted: true,
    meQuery: meNetwork,
  });
  await rerender({
    holding: false,
    gateInput: { ...signedIn },
    onboardingCompleted: false,
    meQuery: meNetwork,
  });

  expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  expect(mockTrackEvent).toHaveBeenCalledWith('gate_routed', {
    group: 'tabs',
    onboarding_completed_source: 'me_network',
    me_age_s: 0,
  });
});

it('an anonymous onboarder with no `me` is routed to onboarding with source none', async () => {
  await renderHook(() =>
    useGateRoutedTracking({
      holding: false,
      gateInput: { isSignedIn: false, isAnonOnboarding: true, hydration: AUTH_HYDRATION.RESOLVED },
      onboardingCompleted: false,
      meQuery: { data: undefined, isFetchedAfterMount: false, dataUpdatedAt: 0 },
    }),
  );
  expect(mockTrackEvent).toHaveBeenCalledWith('gate_routed', {
    group: 'onboarding',
    onboarding_completed_source: 'none',
    me_age_s: null,
  });
});
