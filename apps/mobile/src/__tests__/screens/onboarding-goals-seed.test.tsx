// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// issue 365 T13b (FS-OB1c, V4 a3): the goals step started from an empty set on
// every mount, so after a cold resume to account the on-screen Back showed
// "0 of 5 picked" with Continue disabled. It now seeds from the persisted goals.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
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
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
const mockGoNext = jest.fn();
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingNext: () => mockGoNext,
}));
jest.mock('../../hooks/use-onboarding-back', () => ({ useOnboardingBack: () => jest.fn() }));
jest.mock('../../lib/analytics', () => ({
  AnalyticsEvent: new Proxy({}, { get: (_target, key) => String(key) }),
  captureException: jest.fn(),
  trackEvent: jest.fn(),
}));
jest.mock('../../lib/onboarding-analytics', () => ({ trackOnboardingEvent: jest.fn() }));
// The shell's primary button (with its disabled state) and its footer.
jest.mock('../../components/onboarding/onboarding-shell', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    OnboardingShell: ({
      children,
      footer,
      primary,
    }: {
      children: import('react').ReactNode;
      footer?: import('react').ReactNode;
      primary?: { label: string; onPress: () => void; disabled?: boolean };
    }) => (
      <View>
        {children}
        {footer}
        {primary ? (
          <Pressable
            testID="shell-primary"
            accessibilityState={{ disabled: !!primary.disabled }}
            disabled={primary.disabled}
            onPress={primary.onPress}
          >
            <Text>{primary.label}</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

import { render, screen } from '@testing-library/react-native';
import '../../i18n';
import GoalsScreen from '../../app/(onboarding)/goals';
import { useOnboardingStore } from '../../stores/onboarding.store';

beforeEach(() => {
  useOnboardingStore.getState().reset();
  mockGoNext.mockReset();
});

describe('Onboarding goals step seeds from the store', () => {
  it('two persisted goals: both options checked, "2 of 5 picked", Continue enabled', async () => {
    useOnboardingStore.getState().setRidingGoals(['track_rides', 'maintain_bike']);

    await render(<GoalsScreen />);

    expect(screen.getByText('2 of 5 picked')).toBeTruthy();
    expect(screen.getByTestId('shell-primary').props.accessibilityState).toMatchObject({
      disabled: false,
    });
    const checked = screen
      .getAllByRole('checkbox')
      .filter((node) => node.props.accessibilityState?.checked === true);
    expect(checked).toHaveLength(2);
  });

  it('no persisted goals: "0 of 5 picked", Continue disabled', async () => {
    await render(<GoalsScreen />);

    expect(screen.getByText('0 of 5 picked')).toBeTruthy();
    expect(screen.getByTestId('shell-primary').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
