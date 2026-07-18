// MOT-265: setSession drives first-run vs returning-user routing; partialize
// controls exactly what persists. Mock MMKV (shared factory), i18n, and
// expo-localization so the store can be imported without native deps.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../i18n', () => ({ __esModule: true, default: { changeLanguage: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ measurementSystem: 'metric' }] }));

import type { Session } from '@supabase/supabase-js';
import { MAP_ORIENTATIONS } from '../../utils/map-orientation';
import { partializeAuthState, useAuthStore } from '../auth.store';

const fakeSession = { access_token: 't', user: { id: 'u1' } } as unknown as Session;

beforeEach(() => {
  useAuthStore.setState({
    session: null,
    onboardingCompleted: false,
    hasAuthenticatedBefore: false,
    mapOrientation: MAP_ORIENTATIONS.NORTH,
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
      'mapOrientation',
      'measurementSystem',
    ]);
    expect('session' in persisted).toBe(false);
    expect('isLoading' in persisted).toBe(false);
    expect('onboardingCompleted' in persisted).toBe(false);
  });

  it('includes the mapOrientation value so it persists', () => {
    useAuthStore.setState({ mapOrientation: 'heading' });
    expect(partializeAuthState(useAuthStore.getState()).mapOrientation).toBe('heading');
  });
});

describe('auth.store mapOrientation', () => {
  it('defaults to north-up', () => {
    // Assert the store initializer's default directly (immune to the beforeEach
    // reset and any prior mutation), so the test fails if the shipped default
    // ever changes to heading.
    expect(useAuthStore.getInitialState().mapOrientation).toBe(MAP_ORIENTATIONS.NORTH);
    expect(MAP_ORIENTATIONS.NORTH).toBe('north');
  });

  it('setMapOrientation updates state', () => {
    useAuthStore.getState().setMapOrientation('heading');
    expect(useAuthStore.getState().mapOrientation).toBe('heading');
  });
});
