// MOT-265: setSession drives first-run vs returning-user routing; partialize
// controls exactly what persists. Mock MMKV (shared factory), i18n, and
// expo-localization so the store can be imported without native deps.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../i18n', () => ({ __esModule: true, default: { changeLanguage: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ measurementSystem: 'metric' }] }));

import type { Session } from '@supabase/supabase-js';
import { AUTH_HYDRATION } from '../../lib/auth-hydration';
import { MAP_ORIENTATIONS } from '../../utils/map-orientation';
import { partializeAuthState, useAuthStore } from '../auth.store';

const fakeSession = { access_token: 't', user: { id: 'u1' } } as unknown as Session;

beforeEach(() => {
  useAuthStore.setState({
    session: null,
    isLoading: true,
    hydration: AUTH_HYDRATION.PENDING,
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

// BUG-4 Q1. The root gate used to have exactly two auth states and inferred a
// third ("signed out") from `session === null`, so the hydration safety timeout
// — which drops `isLoading` while the session is still null — routed signed-in
// riders to /login on slow cold starts. These cover the third state.
describe('auth.store hydration', () => {
  it('starts PENDING so the gate holds the splash rather than guessing', () => {
    expect(useAuthStore.getInitialState().hydration).toBe(AUTH_HYDRATION.PENDING);
    expect(useAuthStore.getInitialState().isLoading).toBe(true);
  });

  it('markHydrationUnresolved moves PENDING to UNRESOLVED and stops loading', () => {
    useAuthStore.getState().markHydrationUnresolved();

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.UNRESOLVED);
    expect(s.isLoading).toBe(false);
  });

  // The ordering hazard the whole fix turns on: hydration can land a tick after
  // the timer is scheduled. A late timer must never un-resolve a settled session.
  it('markHydrationUnresolved is a no-op once hydration has RESOLVED', () => {
    useAuthStore.getState().setSession(fakeSession);
    useAuthStore.getState().markHydrationUnresolved();

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.RESOLVED);
    expect(s.session).toBe(fakeSession);
  });

  it('setSession resolves hydration, so a session answer un-sticks the gate', () => {
    useAuthStore.getState().setSession(fakeSession);

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.RESOLVED);
    expect(s.isLoading).toBe(false);
  });

  // INITIAL_SESSION fires with `null` when nothing is stored. That null IS the
  // answer, so a genuinely signed-out cold start must not sit on the restoring
  // screen — it must reach the login screen.
  it('setSession(null) from UNRESOLVED resolves hydration', () => {
    useAuthStore.getState().markHydrationUnresolved();
    useAuthStore.getState().setSession(null);

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.RESOLVED);
    expect(s.session).toBeNull();
    expect(s.isLoading).toBe(false);
  });

  it('forceHydrationResolved lets the restoring screen hand over to (auth)', () => {
    useAuthStore.getState().markHydrationUnresolved();
    useAuthStore.getState().forceHydrationResolved();

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.RESOLVED);
    expect(s.isLoading).toBe(false);
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
    // A persisted RESOLVED would make the next cold start skip the splash hold
    // and route on a stale answer — the exact class of bug this state exists to
    // prevent. It is per-launch by definition.
    expect('hydration' in persisted).toBe(false);
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
