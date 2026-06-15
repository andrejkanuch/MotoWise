// MOT-265: setSession drives first-run vs returning-user routing; partialize
// controls exactly what persists. Mock MMKV (shared factory), i18n, and
// expo-localization so the store can be imported without native deps.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../i18n', () => ({ __esModule: true, default: { changeLanguage: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ measurementSystem: 'metric' }] }));

import type { Session } from '@supabase/supabase-js';
import { partializeAuthState, useAuthStore } from '../auth.store';

const fakeSession = { access_token: 't', user: { id: 'u1' } } as unknown as Session;

beforeEach(() => {
  useAuthStore.setState({
    session: null,
    onboardingCompleted: false,
    hasAuthenticatedBefore: false,
  });
});

describe('auth.store setSession', () => {
  it('marks hasAuthenticatedBefore and preserves onboardingCompleted on sign-in', () => {
    useAuthStore.setState({ onboardingCompleted: true });
    useAuthStore.getState().setSession(fakeSession);

    const s = useAuthStore.getState();
    expect(s.session).toBe(fakeSession);
    expect(s.hasAuthenticatedBefore).toBe(true);
    expect(s.onboardingCompleted).toBe(true); // returning user keeps completion
  });

  it('resets onboardingCompleted on sign-out but keeps hasAuthenticatedBefore', () => {
    useAuthStore.setState({ onboardingCompleted: true, hasAuthenticatedBefore: true });
    useAuthStore.getState().setSession(null);

    const s = useAuthStore.getState();
    expect(s.session).toBeNull();
    expect(s.onboardingCompleted).toBe(false);
    expect(s.hasAuthenticatedBefore).toBe(true);
  });
});

describe('partializeAuthState', () => {
  it('persists exactly the preference keys, excluding session/isLoading/onboardingCompleted', () => {
    const persisted = partializeAuthState(useAuthStore.getState());

    expect(Object.keys(persisted).sort()).toEqual([
      'colorScheme',
      'currency',
      'hasAuthenticatedBefore',
      'locale',
      'measurementSystem',
    ]);
    expect('session' in persisted).toBe(false);
    expect('isLoading' in persisted).toBe(false);
    expect('onboardingCompleted' in persisted).toBe(false);
  });
});
