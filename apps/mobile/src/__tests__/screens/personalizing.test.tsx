// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// issue 365 T16a (FS-OB6): "Open my garage" once. One case per row of the CTA
// state table: idle, pending, pending > 10 s, failed, success. The screen never
// calls the router itself: `setOnboardingCompleted(true)` is the one navigation
// trigger (the root Stack.Protected guard then lands the rider on Home), so
// "navigate once" is asserted on that call.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 54, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));

jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.22.0' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'event-id' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
let mockVariant = 'shipped';
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ totalScreens: 10, stepIndex: 9, variant: mockVariant }),
}));
jest.mock('../../lib/analytics', () => ({
  AnalyticsEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  captureException: jest.fn(),
  setUserPropertiesOnce: jest.fn(),
  trackEvent: jest.fn(),
}));
jest.mock('../../lib/onboarding-analytics', () => ({
  trackOnboardingEvent: jest.fn(),
  trackOnboardingFlowEvent: jest.fn(),
  trackOnboardingCompletion: jest.fn(),
}));
jest.mock('../../lib/meta-analytics', () => ({
  MetaAnalytics: { trackCompleteRegistration: jest.fn() },
}));
jest.mock('../../lib/meta-attribution', () => ({
  getStoredFbclid: async () => null,
  clearStoredFbclid: jest.fn(),
}));
const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...(args as [])),
}));
jest.mock('../../lib/image-upload', () => ({ uploadBikePhoto: jest.fn() }));
jest.mock('../../lib/subscription', () => ({ setSelfReportedSource: jest.fn() }));
const mockPresentPaywall = jest.fn();
jest.mock('../../lib/onboarding-paywall', () => ({
  isGarageCtaPaywall: (variant: string) => variant === 'garage_first',
  presentOnboardingPaywall: (...args: unknown[]) => mockPresentPaywall(...args),
  resolveOnboardingPaywallPlacement: () => ({
    primaryGoal: 'track_rides',
    placement: 'onboarding',
    goals: [],
  }),
}));
// The real shell needs a keyboard controller; this one renders what the
// footer would: the primary (with its disabled/loading state) and the secondary.
type MockAction = { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
jest.mock('../../components/onboarding/onboarding-shell', () => {
  const { Text, View } = require('react-native');
  return {
    OnboardingShell: ({
      title,
      primary,
      secondary,
      children,
    }: {
      title?: string;
      primary?: MockAction;
      secondary?: MockAction;
      children?: React.ReactNode;
    }) => (
      <View>
        {title ? <Text>{title}</Text> : null}
        {children}
        {primary ? (
          // onPress fires even when disabled: the handler itself must be idempotent.
          <Text
            testID="shell-primary"
            accessibilityState={{ disabled: !!primary.disabled, busy: !!primary.loading }}
            onPress={primary.onPress}
          >
            {primary.label}
          </Text>
        ) : null}
        {secondary ? (
          <Text testID="shell-secondary" onPress={secondary.onPress}>
            {secondary.label}
          </Text>
        ) : null}
      </View>
    ),
  };
});
jest.mock('../../components/onboarding/onboarding-bike-plate', () => ({
  OnboardingBikePlate: () => null,
}));

import { CompleteOnboardingDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import '../../i18n';
import PersonalizingScreen from '../../app/(onboarding)/personalizing';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';

const OPEN_GARAGE = 'Open my garage';
const RETRY = 'Retry';
const SKIP = 'Skip and continue';
const PAYOFF_TITLE = 'Welcome home, rider.';

const mockSetOnboardingCompleted = jest.fn();

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const COMPLETED_USER = {
  completeOnboarding: {
    id: 'user-1',
    preferences: {},
    currency: 'EUR',
    createdAt: '2026-11-13T00:00:00Z',
    updatedAt: '2026-11-13T00:00:00Z',
    servicePlanTaskCount: null,
    servicePlanTier: null,
  },
};

/** completeOnboarding answers with the given promise; the unit sync resolves. */
function completeOnboardingWith(result: () => Promise<unknown>) {
  mockFetcher.mockImplementation((document: unknown) =>
    document === CompleteOnboardingDocument ? result() : Promise.resolve({}),
  );
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

async function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(
    <QueryClientProvider client={client}>
      <PersonalizingScreen />
    </QueryClientProvider>,
  );
  // Let the setup run reach the mutation.
  await act(async () => {});
}

/** Renders, lets the mutation succeed and the payoff animation finish. */
async function renderPayoff() {
  completeOnboardingWith(async () => COMPLETED_USER);
  await renderScreen();
  await advance(2000);
  expect(screen.getByText(OPEN_GARAGE)).toBeTruthy();
}

async function tapPrimary() {
  await act(async () => {
    await fireEvent.press(screen.getByTestId('shell-primary'));
  });
}

/** Two taps on the same CTA, as a rider's double tap lands before any re-render. */
async function doubleTapPrimary() {
  const cta = screen.getByTestId('shell-primary');
  await act(async () => {
    await fireEvent.press(cta);
    await fireEvent.press(cta);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockVariant = 'shipped';
  mockFetcher.mockReset();
  mockPresentPaywall.mockReset();
  mockSetOnboardingCompleted.mockReset();
  useOnboardingStore.getState().reset();
  useAuthStore.setState({ setOnboardingCompleted: mockSetOnboardingCompleted });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('personalizing CTA states (FS-OB6)', () => {
  it('idle: "Open my garage" is enabled before the first tap', async () => {
    await renderPayoff();
    const cta = screen.getByTestId('shell-primary');
    expect(cta.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(screen.queryByText(RETRY)).toBeNull();
  });

  it('pending: the first tap disables the CTA with a spinner; a double tap opens one paywall', async () => {
    mockVariant = 'garage_first';
    const paywall = deferred<string>();
    mockPresentPaywall.mockReturnValue(paywall.promise);
    await renderPayoff();

    await doubleTapPrimary();

    expect(mockPresentPaywall).toHaveBeenCalledTimes(1);
    const cta = screen.getByTestId('shell-primary');
    expect(cta.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(screen.queryByText(RETRY)).toBeNull();
    expect(mockSetOnboardingCompleted).not.toHaveBeenCalled();

    // The paywall settles: the rider goes to the garage exactly once.
    await act(async () => {
      paywall.resolve('closed');
    });
    expect(mockSetOnboardingCompleted).toHaveBeenCalledTimes(1);
  });

  it('pending: a double tap without the paywall arm completes once', async () => {
    await renderPayoff();

    await doubleTapPrimary();

    expect(mockPresentPaywall).not.toHaveBeenCalled();
    expect(mockSetOnboardingCompleted).toHaveBeenCalledTimes(1);
    expect(mockSetOnboardingCompleted).toHaveBeenCalledWith(true);
  });

  it('pending > 10 s: only "Skip and continue", never Retry while the save may still succeed', async () => {
    completeOnboardingWith(() => new Promise(() => {}));
    await renderScreen();

    // Every step ticks off well before 10 s; still no Retry and no Skip.
    await advance(9000);
    expect(screen.queryByText(RETRY)).toBeNull();
    expect(screen.queryByText(SKIP)).toBeNull();

    await advance(1500);
    expect(screen.getByText(SKIP)).toBeTruthy();
    expect(screen.queryByText(RETRY)).toBeNull();
    expect(screen.queryByText(OPEN_GARAGE)).toBeNull();

    await advance(30000);
    expect(screen.queryByText(RETRY)).toBeNull();
  });

  it('failed: the mutation error shows Retry and "Skip and continue"', async () => {
    completeOnboardingWith(async () => {
      throw new Error('network');
    });
    await renderScreen();
    await advance(0);

    expect(screen.getByText(RETRY)).toBeTruthy();
    expect(screen.getByText(SKIP)).toBeTruthy();

    // Retry re-runs the save; once it succeeds the payoff shows, Retry is gone.
    completeOnboardingWith(async () => COMPLETED_USER);
    await tapPrimary();
    await advance(2000);
    expect(screen.getByText(OPEN_GARAGE)).toBeTruthy();
    expect(screen.queryByText(RETRY)).toBeNull();
  });

  it('failed after a stall: Retry starts a fresh pending state with no Skip until its own 10 s', async () => {
    const first = deferred<unknown>();
    completeOnboardingWith(() => first.promise);
    await renderScreen();

    // The first save stalls (Skip only), then fails (Retry + Skip).
    await advance(10500);
    expect(screen.getByText(SKIP)).toBeTruthy();
    await act(async () => {
      first.reject(new Error('network'));
    });
    expect(screen.getByText(RETRY)).toBeTruthy();

    // Retry: the new attempt is pending again, with neither Retry nor Skip.
    completeOnboardingWith(() => new Promise(() => {}));
    await tapPrimary();
    expect(screen.queryByText(RETRY)).toBeNull();
    expect(screen.queryByText(SKIP)).toBeNull();

    await advance(9000);
    expect(screen.queryByText(SKIP)).toBeNull();
    await advance(1500);
    expect(screen.getByText(SKIP)).toBeTruthy();
    expect(screen.queryByText(RETRY)).toBeNull();
  });

  it('success: navigates once and the payoff never renders again', async () => {
    await renderPayoff();

    await tapPrimary();
    expect(mockSetOnboardingCompleted).toHaveBeenCalledTimes(1);

    // The screen stays mounted until the root guard swaps the stack: it must
    // not show the payoff (or its CTA) again in that window.
    await advance(15000);
    expect(screen.queryByText(PAYOFF_TITLE)).toBeNull();
    expect(screen.queryByText(OPEN_GARAGE)).toBeNull();
    expect(screen.queryByText(RETRY)).toBeNull();
    expect(mockSetOnboardingCompleted).toHaveBeenCalledTimes(1);
  });
});
