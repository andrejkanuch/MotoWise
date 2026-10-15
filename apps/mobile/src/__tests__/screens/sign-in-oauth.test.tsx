// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route (its context regex only skips +api/+html), so a test there would
// be bundled into the app as a screen.
//
// The Google tap on the onboarding sign-in screen. jest-expo inlines
// `process.env.EXPO_OS` to 'ios' at transform time, so "no vibration on
// Android" cannot be observed here by flipping the platform; what can be pinned
// is the mechanism that produces it: the tap goes through the iOS-guarded
// `triggerImpact` wrapper and never calls expo-haptics itself.
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ variant: 'garage_first', stepIndex: -1, totalScreens: 0 }),
}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('../../components/onboarding/oauth-glyphs', () => ({
  AppleGlyph: () => null,
  GoogleGlyph: () => null,
}));
const mockSignInWithGoogle = jest.fn();
jest.mock('../../lib/oauth', () => ({
  signInWithApple: jest.fn(),
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  reportUnexpectedAuthError: jest.fn(),
}));
jest.mock('../../lib/oauth-error-alert', () => ({ presentOAuthError: jest.fn() }));
jest.mock('../../lib/onboarding-analytics', () => ({ trackOnboardingFlowEvent: jest.fn() }));

const mockTrackEvent = jest.fn();
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn() } } }));
jest.mock('../../lib/email-confirmation', () => ({
  ...jest.requireActual('../../lib/email-confirmation'),
  sendSignupCode: jest.fn(),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import OnboardingSignInScreen from '../../app/(onboarding)/sign-in';
import i18n from '../../i18n';
import { triggerImpact } from '../../utils/haptics';

const t = (key: string) => i18n.t(key);

async function tapGoogle() {
  await render(<OnboardingSignInScreen />);
  await fireEvent.press(screen.getByText(t('auth.continueWithGoogle')));
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignInWithGoogle.mockResolvedValue({ isNewUser: false });
});

describe('Onboarding sign-in, Google button', () => {
  it('plays the tap haptic through the iOS-guarded wrapper, never expo-haptics directly', async () => {
    await tapGoogle();

    expect(triggerImpact).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('a returning account still fires user_signed_in once with auth_method google', async () => {
    await tapGoogle();

    expect(mockTrackEvent.mock.calls).toEqual([['USER_SIGNED_IN', { auth_method: 'google' }]]);
  });
});
