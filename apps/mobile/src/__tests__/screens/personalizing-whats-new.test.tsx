// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// A rider finishing onboarding must not land on Home under What's New: the
// personalizing screen's setup run marks the installed version seen before its
// first await. `lib/__tests__/whats-new.test.ts` covers the helper; this proves
// the screen calls it, and early enough.
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

// Inline in the factory: jest.mock is hoisted above every declaration.
jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.22.0' }));
const INSTALLED_VERSION = '3.22.0';
jest.mock('expo-crypto', () => ({ randomUUID: () => 'event-id' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ totalScreens: 10, stepIndex: 9, variant: 'shipped' }),
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
}));
jest.mock('../../lib/meta-analytics', () => ({
  MetaAnalytics: { trackCompleteRegistration: jest.fn() },
}));
// The run's first await. Never settling holds the run right there, so the
// assertion below can only pass if the mark happens before it.
const mockGetStoredFbclid = jest.fn(() => new Promise<string | null>(() => {}));
jest.mock('../../lib/meta-attribution', () => ({
  getStoredFbclid: () => mockGetStoredFbclid(),
  clearStoredFbclid: jest.fn(),
}));
const mockFetcher = jest.fn(() => new Promise(() => {}));
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...(args as [])),
}));
jest.mock('../../lib/image-upload', () => ({ uploadBikePhoto: jest.fn() }));
jest.mock('../../lib/subscription', () => ({ setSelfReportedSource: jest.fn() }));
jest.mock('../../lib/onboarding-paywall', () => ({
  ONBOARDING_PAYWALL_SURFACE: {},
  presentOnboardingPaywall: jest.fn(),
  resolveOnboardingPaywallPlacement: () => ({
    primaryGoal: 'track_rides',
    placement: 'onboarding',
    goals: [],
  }),
}));
jest.mock('../../lib/garage-paywall-handoff', () => ({
  createGaragePaywallHandoff: jest.fn(),
}));
jest.mock('../../components/onboarding/onboarding-shell', () => ({
  OnboardingShell: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../components/onboarding/onboarding-bike-plate', () => ({
  OnboardingBikePlate: () => null,
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type React from 'react';
import '../../i18n';
import PersonalizingScreen from '../../app/(onboarding)/personalizing';
import { isWhatsNewOwed } from '../../lib/whats-new';
import { useWhatsNewStore } from '../../stores/whats-new.store';

beforeEach(() => {
  useWhatsNewStore.setState({ lastSeenVersion: null });
});

describe('personalizing → What’s New', () => {
  it('marks the installed version seen as soon as the setup run starts', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await render(
      <QueryClientProvider client={client}>
        <PersonalizingScreen />
      </QueryClientProvider>,
    );

    // The run is parked on its first await and has saved nothing yet...
    expect(mockGetStoredFbclid).toHaveBeenCalledTimes(1);
    expect(mockFetcher).not.toHaveBeenCalled();
    // ...but the rider is already not owed What's New for this install.
    expect(useWhatsNewStore.getState().lastSeenVersion).toBe(INSTALLED_VERSION);
    expect(isWhatsNewOwed(INSTALLED_VERSION, useWhatsNewStore.getState().lastSeenVersion)).toBe(
      false,
    );
  });
});
