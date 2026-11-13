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

import {
  dehydrate,
  hydrate,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { OB_SCREEN } from '../../config/onboarding';
import { AUTH_HYDRATION, type AuthGateInput } from '../../lib/auth-hydration';
import {
  recordOnboardingFocus,
  resetOnboardingNavAnalyticsForTests,
} from '../../lib/onboarding-nav-analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { useGateRoutedTracking } from '../use-gate-routed-tracking';

const signedIn: AuthGateInput = {
  isSignedIn: true,
  isAnonOnboarding: false,
  hydration: AUTH_HYDRATION.RESOLVED,
};
const meNetwork = { data: { me: {} }, dataUpdatedAt: Date.now() + 1 };
const ME_KEY = ['user', 'me'];

beforeEach(() => {
  mockTrackEvent.mockClear();
  resetOnboardingNavAnalyticsForTests();
  useOnboardingStore.getState().reset();
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
      meQuery: { data: undefined, dataUpdatedAt: 0 },
    }),
  );
  expect(mockTrackEvent).toHaveBeenCalledWith('gate_routed', {
    group: 'onboarding',
    onboarding_completed_source: 'none',
    me_age_s: null,
  });
});

it('`me` restored from the persisted cache after the gate mounted is me_cache', async () => {
  // As in _layout: the gate's `me` observer mounts before PersistQueryClientProvider
  // finishes its async restore, which then hydrate()s last launch's `me`.
  const previousLaunch = new QueryClient();
  previousLaunch.setQueryData(ME_KEY, { me: {} }, { updatedAt: Date.now() - 60_000 });
  const persisted = dehydrate(previousLaunch);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);

  const { result } = await renderHook(
    () => {
      const meQuery = useQuery({
        queryKey: ME_KEY,
        queryFn: () => new Promise(() => {}),
        enabled: false,
      });
      useGateRoutedTracking({
        holding: meQuery.data === undefined,
        gateInput: signedIn,
        onboardingCompleted: true,
        meQuery,
      });
      return meQuery;
    },
    { wrapper },
  );
  expect(mockTrackEvent).not.toHaveBeenCalled();

  await act(async () => hydrate(client, persisted));
  await waitFor(() => expect(result.current.data).toBeDefined());

  // The trap the launch timestamp avoids: hydrate counts as an update after mount.
  expect(result.current.isFetchedAfterMount).toBe(true);
  expect(mockTrackEvent).toHaveBeenCalledTimes(1);
  expect(mockTrackEvent).toHaveBeenCalledWith('gate_routed', {
    group: 'tabs',
    onboarding_completed_source: 'me_cache',
    me_age_s: 60,
  });
});

it('opening (tabs) clears the onboarding resume point; onboarding keeps it', async () => {
  recordOnboardingFocus(OB_SCREEN.SIGN_IN, 1);
  useOnboardingStore.getState().setLastCompletedScreen(OB_SCREEN.WELCOME);
  const { rerender } = await renderHook(
    (props: Parameters<typeof useGateRoutedTracking>[0]) => useGateRoutedTracking(props),
    {
      initialProps: {
        holding: false,
        gateInput: signedIn,
        onboardingCompleted: false,
        meQuery: meNetwork,
      },
    },
  );
  expect(useOnboardingStore.getState().lastViewedScreen).toBe(OB_SCREEN.SIGN_IN);

  await rerender({
    holding: false,
    gateInput: signedIn,
    onboardingCompleted: true,
    meQuery: meNetwork,
  });
  expect(useOnboardingStore.getState()).toMatchObject({
    lastViewedScreen: null,
    lastViewedAt: null,
    lastCompletedScreen: null,
    codeStepPending: false,
  });
});
