// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// The notifications step's "the developer may contact me" line: kept whichever
// button is tapped, never asks for notifications by itself, and reaches the
// account through completeOnboarding only when ticked.
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
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-application', () => ({ __esModule: true, nativeApplicationVersion: '3.25.0' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'event-id' }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
const mockRequestPermissions = jest.fn();
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => Promise.resolve({ status: 'undetermined', canAskAgain: true }),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
}));
const mockGoNext = jest.fn();
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingNext: () => mockGoNext,
  useOnboardingStep: () => ({ totalScreens: 10, stepIndex: 9, variant: 'shipped' }),
}));
jest.mock('../../hooks/use-onboarding-back', () => ({ useOnboardingBack: () => jest.fn() }));
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
jest.mock('../../lib/notifications', () => ({ setupNotificationChannels: jest.fn() }));
jest.mock('../../lib/push-token', () => ({ registerForPushNotifications: jest.fn() }));
jest.mock('../../lib/meta-analytics', () => ({
  MetaAnalytics: { trackCompleteRegistration: jest.fn() },
}));
jest.mock('../../lib/meta-attribution', () => ({
  getStoredFbclid: () => Promise.resolve(null),
  clearStoredFbclid: jest.fn(),
}));
const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('../../lib/image-upload', () => ({ uploadBikePhoto: jest.fn() }));
jest.mock('../../lib/subscription', () => ({
  resyncTrialReminder: jest.fn(),
  setSelfReportedSource: jest.fn(),
}));
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
jest.mock('../../components/onboarding/onboarding-bike-plate', () => ({
  OnboardingBikePlate: () => null,
}));
// The shell's two buttons and its footer, without the keyboard-aware chrome.
jest.mock('../../components/onboarding/onboarding-shell', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    OnboardingShell: ({
      children,
      footer,
      primary,
      secondary,
    }: {
      children: import('react').ReactNode;
      footer?: import('react').ReactNode;
      primary?: { label: string; onPress: () => void };
      secondary?: { label: string; onPress: () => void };
    }) => (
      <View>
        {children}
        {footer}
        {primary ? (
          <Pressable testID="shell-primary" onPress={primary.onPress}>
            <Text>{primary.label}</Text>
          </Pressable>
        ) : null}
        {secondary ? (
          <Pressable testID="shell-secondary" onPress={secondary.onPress}>
            <Text>{secondary.label}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

import { CompleteOnboardingDocument } from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import '../../i18n';
import NotificationsStep from '../../app/(onboarding)/notifications';
import PersonalizingScreen from '../../app/(onboarding)/personalizing';
import { useOnboardingStore } from '../../stores/onboarding.store';

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function renderWithClient(node: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function completeOnboardingInputs() {
  return mockFetcher.mock.calls
    .filter(([doc]) => doc === CompleteOnboardingDocument)
    .map(([, vars]) => (vars as { input: Record<string, unknown> }).input);
}

beforeEach(() => {
  useOnboardingStore.getState().reset();
  mockFetcher.mockReset();
  mockFetcher.mockResolvedValue({});
  mockRequestPermissions.mockReset();
  mockGoNext.mockReset();
});

describe('onboarding notifications step — contact line', () => {
  it('starts unticked; ticking then Maybe later keeps the choice and asks for nothing', async () => {
    await renderWithClient(<NotificationsStep />);
    const line = screen.getByTestId('onboarding-feedback-contact');
    expect(line).not.toBeChecked();

    await fireEvent.press(line);
    expect(screen.getByTestId('onboarding-feedback-contact')).toBeChecked();
    await fireEvent.press(screen.getByTestId('shell-secondary'));

    expect(useOnboardingStore.getState().feedbackContactOptIn).toBe(true);
    expect(mockRequestPermissions).not.toHaveBeenCalled();
    expect(mockGoNext).toHaveBeenCalledTimes(1);
  });

  it('leaves Enable and Maybe later as they were', async () => {
    await renderWithClient(<NotificationsStep />);

    expect(screen.getByTestId('shell-primary')).toHaveTextContent('Enable Notifications');
    expect(screen.getByTestId('shell-secondary')).toHaveTextContent('Maybe later');
  });
});

describe('personalizing — completeOnboarding', () => {
  it('sends feedbackContactOptIn with the shown wording version and locale when ticked', async () => {
    useOnboardingStore.getState().setFeedbackContactOptIn(true);
    await renderWithClient(<PersonalizingScreen />);
    await flush();

    expect(completeOnboardingInputs()[0].feedbackContactOptIn).toEqual({
      wordingVersion: 1,
      locale: 'en',
    });
  });

  it('omits the field when the line was left unticked', async () => {
    await renderWithClient(<PersonalizingScreen />);
    await flush();

    expect(completeOnboardingInputs()[0]).not.toHaveProperty('feedbackContactOptIn');
  });
});
