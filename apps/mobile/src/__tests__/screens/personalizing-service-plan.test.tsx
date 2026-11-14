// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// issue 365 T07b: `onboarding_completed` carries the service plan the API
// imported for the onboarding bike (`completeOnboarding.servicePlanTaskCount` /
// `servicePlanTier`), so PostHog can read Experiment 2 per app version.
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
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ totalScreens: 10, stepIndex: 9, variant: 'shipped' }),
}));
const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  AnalyticsEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  captureException: jest.fn(),
  setUserPropertiesOnce: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
// The real `onboarding_completed` wrapper, so the test reads the event payload.
jest.mock('../../lib/onboarding-analytics', () => ({
  ...jest.requireActual('../../lib/onboarding-analytics'),
  trackOnboardingEvent: jest.fn(),
}));
jest.mock('../../lib/meta-analytics', () => ({
  MetaAnalytics: { trackCompleteRegistration: jest.fn() },
}));
const mockGetStoredFbclid = jest.fn(async () => null);
jest.mock('../../lib/meta-attribution', () => ({
  getStoredFbclid: () => mockGetStoredFbclid(),
  clearStoredFbclid: jest.fn(),
}));
const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...(args as [])),
}));
const mockClearEmailDraft = jest.fn(async () => {});
jest.mock('../../lib/onboarding-email-draft', () => ({
  clearEmailDraft: () => mockClearEmailDraft(),
}));
jest.mock('../../lib/image-upload', () => ({ uploadBikePhoto: jest.fn() }));
jest.mock('../../lib/subscription', () => ({ setSelfReportedSource: jest.fn() }));
jest.mock('../../lib/onboarding-paywall', () => ({
  ONBOARDING_PAYWALL_SURFACE: {},
  isGarageCtaPaywall: (variant: string) => variant === 'garage_first',
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

import { CompleteOnboardingDocument } from '@motovault/graphql';
import { MotorcycleType } from '@motovault/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';
import type React from 'react';
import '../../i18n';
import PersonalizingScreen from '../../app/(onboarding)/personalizing';
import { useOnboardingStore } from '../../stores/onboarding.store';

function completeOnboardingResult(servicePlan: {
  servicePlanTaskCount: number | null;
  servicePlanTier: string | null;
}) {
  mockFetcher.mockImplementation(async (document: unknown) =>
    document === CompleteOnboardingDocument
      ? {
          completeOnboarding: {
            id: 'user-1',
            preferences: {},
            currency: 'EUR',
            createdAt: '2026-11-13T00:00:00Z',
            updatedAt: '2026-11-13T00:00:00Z',
            ...servicePlan,
          },
        }
      : {},
  );
}

const ONBOARDING_COMPLETED = 'ONBOARDING_COMPLETED';

function completedEvents() {
  return mockTrackEvent.mock.calls.filter(([event]) => event === ONBOARDING_COMPLETED);
}

async function completedProperties(): Promise<Record<string, unknown>> {
  await waitFor(() => expect(completedEvents()).toHaveLength(1));
  return completedEvents()[0]?.[1] as Record<string, unknown>;
}

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <PersonalizingScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockFetcher.mockReset();
  mockTrackEvent.mockReset();
  useOnboardingStore.getState().reset();
  useOnboardingStore.getState().setBikeData({
    make: 'Yamaha',
    makeId: 1,
    model: 'MT-09',
    year: 2019,
    type: MotorcycleType.STANDARD,
    currentMileage: 0,
    mileageUnit: 'km',
  });
});

describe('personalizing → onboarding_completed service plan', () => {
  it('reports the imported task count and tier', async () => {
    completeOnboardingResult({ servicePlanTaskCount: 12, servicePlanTier: 'model' });
    await renderScreen();
    expect(await completedProperties()).toEqual(
      expect.objectContaining({
        has_bike: true,
        bike_model: 'MT-09',
        service_plan_task_count: 12,
        service_plan_tier: 'model',
      }),
    );
  });

  it('a result without a plan reports 0 and no tier', async () => {
    completeOnboardingResult({ servicePlanTaskCount: null, servicePlanTier: null });
    await renderScreen();
    const properties = await completedProperties();
    expect(properties.service_plan_task_count).toBe(0);
    expect(properties).not.toHaveProperty('service_plan_tier');
  });
});

// issue 365 T13a (D10): the address is kept on the device only until onboarding ends.
describe('personalizing → email draft', () => {
  it('clears the SecureStore email draft once onboarding is complete', async () => {
    completeOnboardingResult({ servicePlanTaskCount: 0, servicePlanTier: null });
    // beforeEach's reset() also clears it; count only the completion.
    mockClearEmailDraft.mockClear();
    await renderScreen();
    await completedProperties();

    await waitFor(() => expect(useOnboardingStore.getState().completionSent).toBe(true));
    expect(mockClearEmailDraft).toHaveBeenCalled();
  });
});
