// Lives outside src/app on purpose: expo-router turns every file under src/app
// into a route, so a test there would be bundled into the app as a screen.
//
// issue 365 T11 (FS-OB1a): the onboarding sign-in screen used to do nothing when
// the session landed. The root gate keeps (onboarding) mounted for an account
// that has not finished onboarding, so the rider stayed on "Welcome back." with
// a valid session. Once the session and the server `me` state are settled the
// screen now moves on: an onboarded account is left to the gate (tabs), any
// other account continues onboarding at its resume point (or Experience) with
// the "account ready" notice param.
jest.mock('../../hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => ({ variant: 'garage_first', stepIndex: -1, totalScreens: 0 }),
  useOnboardingVariant: () => 'garage_first',
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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };
const mockNavigationState = { routes: [{ name: 'index' }, { name: 'sign-in' }] };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => ({ getState: () => mockNavigationState }),
}));
jest.mock('../../components/onboarding/oauth-glyphs', () => ({
  AppleGlyph: () => null,
  GoogleGlyph: () => null,
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn() },
  isSuccessResponse: jest.fn(),
  isErrorWithCode: (e: unknown) => typeof e === 'object' && e !== null && 'code' in e,
  statusCodes: {},
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({}));
jest.mock('../../lib/oauth-error-alert', () => ({ presentOAuthError: jest.fn() }));
const mockTrackFlowEvent = jest.fn();
jest.mock('../../lib/onboarding-analytics', () => ({
  trackOnboardingFlowEvent: (...args: unknown[]) => mockTrackFlowEvent(...args),
}));
jest.mock('../../lib/analytics', () => ({
  captureException: jest.fn(),
  trackEvent: jest.fn(),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn() } } }));

const mockMeQuery = {
  isLoading: false,
  isError: false,
  data: { me: { preferences: { onboardingCompleted: false } } } as unknown,
};
jest.mock('@tanstack/react-query', () => ({ useQuery: () => mockMeQuery }));
jest.mock('../../lib/query-options', () => ({ meOptions: () => ({}) }));

const mockOnboardingState = {
  lastCompletedScreen: null as string | null,
  bikeData: null as { make: string } | null,
};
jest.mock('../../stores/onboarding.store', () => ({
  useOnboardingStore: { getState: () => mockOnboardingState },
}));
jest.mock('../../stores/auth.store', () => {
  const { create } = require('zustand');
  return { useAuthStore: create(() => ({ session: null })) };
});

import { act, render, screen } from '@testing-library/react-native';
import OnboardingSignInScreen from '../../app/(onboarding)/sign-in';
import { useAuthStore } from '../../stores/auth.store';

const SESSION = { user: { id: 'user-1' }, access_token: 'token' };

async function renderThenSignIn() {
  await render(<OnboardingSignInScreen />);
  await act(async () => {
    useAuthStore.setState({ session: SESSION });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: null });
  mockMeQuery.isLoading = false;
  mockMeQuery.isError = false;
  mockMeQuery.data = { me: { preferences: { onboardingCompleted: false } } };
  mockOnboardingState.lastCompletedScreen = null;
  mockOnboardingState.bikeData = null;
  mockNavigationState.routes = [{ name: 'index' }, { name: 'sign-in' }];
});

describe('Onboarding sign-in, the session lands', () => {
  it('carries the sign-in screen testID', async () => {
    await render(<OnboardingSignInScreen />);

    expect(screen.getByTestId('onboarding-sign-in-screen')).toBeTruthy();
  });

  it('an account with no onboarding progress continues at Experience with the account-ready notice', async () => {
    await renderThenSignIn();

    expect(mockRouter.replace.mock.calls).toEqual([
      [{ pathname: '/(onboarding)/experience', params: { notice: 'account_ready' } }],
    ]);
    expect(mockTrackFlowEvent).toHaveBeenCalledWith('ONBOARDING_STARTED', {});
  });

  it('an account with progress on this device resumes after its last completed step', async () => {
    mockOnboardingState.lastCompletedScreen = 'experience';

    await renderThenSignIn();

    expect(mockRouter.replace.mock.calls).toEqual([
      [{ pathname: '/(onboarding)/bike-setup', params: { notice: 'account_ready' } }],
    ]);
    expect(mockTrackFlowEvent).not.toHaveBeenCalled();
  });

  it('an onboarded account is left to the root gate (tabs): no onboarding navigation', async () => {
    mockMeQuery.data = { me: { preferences: { onboardingCompleted: true } } };

    await renderThenSignIn();

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('waits for the server onboarding state before moving', async () => {
    mockMeQuery.isLoading = true;
    mockMeQuery.data = undefined;

    await renderThenSignIn();
    expect(mockRouter.replace).not.toHaveBeenCalled();

    mockMeQuery.isLoading = false;
    mockMeQuery.data = { me: { preferences: { onboardingCompleted: false } } };
    await act(async () => {
      screen.rerender(<OnboardingSignInScreen />);
    });

    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('a failed `me` still continues onboarding instead of stranding the rider', async () => {
    mockMeQuery.isError = true;
    mockMeQuery.data = undefined;

    await renderThenSignIn();

    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('moves once, however often the screen re-renders', async () => {
    await renderThenSignIn();
    await act(async () => {
      screen.rerender(<OnboardingSignInScreen />);
    });

    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it('opened from the account step, leaves the move to that step', async () => {
    mockNavigationState.routes = [{ name: 'paywall' }, { name: 'account' }, { name: 'sign-in' }];

    await renderThenSignIn();

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('does nothing without a session', async () => {
    await render(<OnboardingSignInScreen />);

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
