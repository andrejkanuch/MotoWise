// The auto-show gate: one decision per session, made only when nothing the
// rider is doing would be interrupted (a ride, CarPlay, the consent screen, a
// paywall, onboarding). Each test loads the hook fresh, because its one-shot
// state lives at module level on purpose (it must survive StrictMode).
import type * as TestingLibrary from '@testing-library/react-native/pure';
import type * as ReactModule from 'react';

jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());

const mockEnv = {
  version: '3.28.0' as string | null,
  segments: ['(tabs)'] as string[],
  carPlayConnected: false,
  phoneSceneVisible: true,
  consentOwed: false,
  paywallInFlight: false,
  paywallSettled: null as Promise<void> | null,
  arm: { arm: 'treatment', source: 'posthog' },
};
const mockPush = jest.fn();
const mockTrackEvent = jest.fn();
const mockResolveArm = jest.fn(() => Promise.resolve(mockEnv.arm));

jest.mock('expo-application', () => ({
  get nativeApplicationVersion() {
    return mockEnv.version;
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useSegments: () => mockEnv.segments,
}));
jest.mock('../../carplay/use-carplay', () => ({
  useCarPlayConnection: () => ({ connected: mockEnv.carPlayConnected }),
  usePhoneSceneVisible: () => mockEnv.phoneSceneVisible,
}));
jest.mock('@/lib/analytics-consent', () => ({
  isConsentPromptOwed: () => mockEnv.consentOwed,
}));
jest.mock('@/lib/subscription', () => ({
  isPaywallInFlight: () => mockEnv.paywallInFlight,
  paywallFlightSettled: () => mockEnv.paywallSettled,
}));
jest.mock('@/lib/whats-new-experiment', () => ({
  resolveWhatsNewArm: () => mockResolveArm(),
}));
jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
jest.mock('@/stores/auth.store', () => {
  const { create } = require('zustand');
  return {
    useAuthStore: create(() => ({
      session: { user: { id: 'rider' } },
      isLoading: false,
      onboardingCompleted: true,
    })),
  };
});
jest.mock('@/stores/onboarding.store', () => {
  const { create } = require('zustand');
  return { useOnboardingStore: create(() => ({ awaitingGarageCta: false })) };
});
jest.mock('@/stores/ride.store', () => {
  const { create } = require('zustand');
  return { useRideStore: create(() => ({ status: 'idle' })) };
});

type GateModules = {
  React: typeof ReactModule;
  rtl: typeof TestingLibrary;
  useWhatsNewGate: () => void;
  useRideStore: { setState: (s: { status: string }) => void };
  useWhatsNewStore: {
    getState: () => { lastSeenVersion: string | null };
    setState: (s: { lastSeenVersion: string | null }) => void;
  };
};

let gate: GateModules;

function loadGate(lastSeenVersion: string | null = '3.25.0') {
  // A fresh module registry per test (React and the testing library included,
  // so hooks share one React) resets the gate's session state.
  jest.resetModules();
  gate = {
    React: require('react'),
    rtl: require('@testing-library/react-native/pure'),
    useWhatsNewGate: require('../use-whats-new-gate').useWhatsNewGate,
    useRideStore: require('@/stores/ride.store').useRideStore,
    useWhatsNewStore: require('@/stores/whats-new.store').useWhatsNewStore,
  };
  gate.useWhatsNewStore.setState({ lastSeenVersion });
}

function renderGate(options: { strict?: boolean } = {}) {
  const { StrictMode, createElement } = gate.React;
  const strictWrapper = ({ children }: { children: ReactModule.ReactNode }) =>
    createElement(StrictMode, null, children);
  return gate.rtl.renderHook(() => gate.useWhatsNewGate(), {
    wrapper: options.strict ? strictWrapper : undefined,
  });
}

const act = (callback: () => unknown) => gate.rtl.act(callback as () => Promise<void>);

/** Lets the arm resolution settle, then runs out the show delay. */
async function settle() {
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  await act(async () => {});
}

const eligibleCalls = () =>
  mockTrackEvent.mock.calls.filter(([event]) => event === 'WHATS_NEW_ELIGIBLE');

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockClear();
  mockTrackEvent.mockClear();
  mockResolveArm.mockClear();
  Object.assign(mockEnv, {
    version: '3.28.0',
    segments: ['(tabs)'],
    carPlayConnected: false,
    phoneSceneVisible: true,
    consentOwed: false,
    paywallInFlight: false,
    paywallSettled: null,
    arm: { arm: 'treatment', source: 'posthog' },
  });
});

afterEach(() => {
  gate?.rtl.cleanup();
  jest.useRealTimers();
});

describe('useWhatsNewGate', () => {
  it('owed, all clear, treatment: logs eligible once, pushes once after the delay, leaves seen to the screen', async () => {
    loadGate();
    await renderGate();

    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
    await settle();

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(modals)/whats-new',
      params: { source: 'auto' },
    });
    expect(eligibleCalls()).toHaveLength(1);
    expect(eligibleCalls()[0][1]).toEqual({
      version: '3.28.0',
      arm: 'treatment',
      arm_source: 'posthog',
      pages: expect.any(Number),
      source: 'auto',
    });
    expect(mockTrackEvent).not.toHaveBeenCalledWith('WHATS_NEW_VIEWED', expect.anything());
    expect(gate.useWhatsNewStore.getState().lastSeenVersion).toBe('3.25.0');
  });

  it('owed, holdout: logs eligible with the holdout arm, marks the release seen, never pushes', async () => {
    mockEnv.arm = { arm: 'holdout', source: 'posthog' };
    loadGate();
    await renderGate();
    await settle();

    expect(mockPush).not.toHaveBeenCalled();
    expect(eligibleCalls()).toHaveLength(1);
    expect(eligibleCalls()[0][1]).toMatchObject({ arm: 'holdout', version: '3.28.0' });
    expect(gate.useWhatsNewStore.getState().lastSeenVersion).toBe('3.28.0');
  });

  it('not owed: no arm draw and no event', async () => {
    loadGate('3.28.0');
    await renderGate();
    await settle();

    expect(mockResolveArm).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('waits out a recording ride, then shows once the ride is gone without having ended', async () => {
    loadGate();
    gate.useRideStore.setState({ status: 'recording' });
    await renderGate();
    await settle();
    expect(mockResolveArm).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    await act(() => gate.useRideStore.setState({ status: 'idle' }));
    await settle();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('a ride that ended this session blocks the auto-show for the rest of the session', async () => {
    loadGate();
    gate.useRideStore.setState({ status: 'recording' });
    await renderGate();
    await settle();

    await act(() => gate.useRideStore.setState({ status: 'ended' }));
    await settle();
    await act(() => gate.useRideStore.setState({ status: 'idle' }));
    await settle();

    expect(mockResolveArm).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('a ride starting during the show delay cancels the push', async () => {
    loadGate();
    await renderGate();
    await act(async () => {});
    await act(() => gate.useRideStore.setState({ status: 'recording' }));
    await settle();

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('CarPlay connected at launch: no arm draw, no push, no seen write', async () => {
    mockEnv.carPlayConnected = true;
    loadGate();
    await renderGate();
    await settle();

    expect(mockResolveArm).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(gate.useWhatsNewStore.getState().lastSeenVersion).toBe('3.25.0');
  });

  it('phone scene hidden (CarPlay only): no push', async () => {
    mockEnv.phoneSceneVisible = false;
    loadGate();
    await renderGate();
    await settle();

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('consent owed: no push while it is owed or on screen, shows after the rider answers', async () => {
    mockEnv.consentOwed = true;
    loadGate();
    const { rerender } = await renderGate();
    await settle();
    expect(mockResolveArm).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    mockEnv.segments = ['analytics-consent'];
    await rerender({});
    await settle();
    expect(mockPush).not.toHaveBeenCalled();

    mockEnv.consentOwed = false;
    mockEnv.segments = ['(tabs)'];
    await rerender({});
    await settle();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('a paywall in flight when the timer fires: no push, then retried once the flight settles', async () => {
    loadGate();
    await renderGate();
    await act(async () => {});

    let finishFlight = () => {};
    mockEnv.paywallInFlight = true;
    mockEnv.paywallSettled = new Promise<void>((resolve) => {
      finishFlight = resolve;
    });
    await settle();
    expect(mockPush).not.toHaveBeenCalled();

    mockEnv.paywallInFlight = false;
    mockEnv.paywallSettled = null;
    await act(async () => finishFlight());
    await settle();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(eligibleCalls()).toHaveLength(1);
  });

  it('onboarding seen this session: no auto-show even after landing in tabs', async () => {
    mockEnv.segments = ['(onboarding)', 'personalizing'];
    loadGate();
    const { rerender } = await renderGate();
    await settle();

    mockEnv.segments = ['(tabs)'];
    await rerender({});
    await settle();

    expect(mockResolveArm).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('StrictMode double mount: one arm draw, one eligible event, one push', async () => {
    loadGate();
    await renderGate({ strict: true });
    await settle();

    expect(mockResolveArm).toHaveBeenCalledTimes(1);
    expect(eligibleCalls()).toHaveLength(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
