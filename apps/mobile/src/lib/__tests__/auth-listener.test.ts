// BUG-4 Q1 — the root layout's auth-listener contract.
//
// `_layout.tsx` no longer calls `supabase.auth.getSession()`. Resolution now
// comes solely from `onAuthStateChange`, which supabase-js guarantees fires
// INITIAL_SESSION exactly once per subscriber once hydration finishes —
// including with `null` when nothing is stored and with `null` from the
// hydration-error catch path. These tests pin both halves of that contract:
// the source-level shape of the listener wiring, and the store transitions the
// handler drives.
//
// The handler itself is not extracted: its body is ~90 lines of side effects
// (RevenueCat, PostHog, query cache, sync queue, notifications, widgets) that
// belong to the root component. What matters for hydration is the sequence of
// store calls it makes, which is what the second block replays.

jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../../i18n', () => ({ __esModule: true, default: { changeLanguage: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ measurementSystem: 'metric' }] }));

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Session } from '@supabase/supabase-js';
import { useAuthStore } from '../../stores/auth.store';
import { AUTH_HYDRATION } from '../auth-hydration';

/**
 * `_layout.tsx` with comment lines stripped. The comments deliberately NAME the
 * calls these tests assert are gone (a reader needs to know why `getSession()`
 * is absent), so matching against the raw source would always fail.
 */
const LAYOUT_CODE = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8')
  .split('\n')
  .filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
  })
  .join('\n');

const fakeSession = { access_token: 't', user: { id: 'u1' } } as unknown as Session;

beforeEach(() => {
  useAuthStore.setState({
    session: null,
    isLoading: true,
    hydration: AUTH_HYDRATION.PENDING,
    onboardingCompleted: false,
    hasAuthenticatedBefore: false,
  });
});

describe('_layout.tsx auth wiring', () => {
  it('registers an onAuthStateChange subscription', () => {
    expect(LAYOUT_CODE).toContain('supabase.auth.onAuthStateChange');
  });

  // The deleted call duplicated `__loadSession`: two chunked Keychain reads and,
  // on a cold start, two racing blocking token refreshes — for a result
  // INITIAL_SESSION already delivers to the same handler.
  it('does not also call supabase.auth.getSession() at boot', () => {
    expect(LAYOUT_CODE).not.toContain('.getSession()');
  });

  // BUG-4 Q2. Sentry has no non-issue message destination: every captured
  // message becomes an Issue under `is:unresolved` whatever its level. Both
  // sites in this file are telemetry and now use addBreadcrumb instead. This is
  // the cheapest guard against the pattern creeping back.
  it('captures no Sentry messages — telemetry goes to breadcrumbs, not issues', () => {
    expect(LAYOUT_CODE).not.toContain('captureMessage(');
    expect(LAYOUT_CODE).toContain('addBreadcrumb(AUTH_HYDRATION_TIMEOUT_MESSAGE');
    expect(LAYOUT_CODE).toContain('addBreadcrumb(SIGNOUT_UNSYNCED_MESSAGE');
  });

  // Raising the timeout alone was explicitly NOT the fix, but the old 8s budget
  // could not cover a chunked Keychain read plus a blocking token refresh.
  it('routes the timeout through markHydrationUnresolved, never setLoading(false)', () => {
    expect(LAYOUT_CODE).toContain('markHydrationUnresolved()');
    expect(LAYOUT_CODE).not.toContain('setLoading(false)');
  });
});

describe('INITIAL_SESSION resolution (handler contract)', () => {
  it('resolves hydration with the restored session', () => {
    useAuthStore.getState().setSession(fakeSession);

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.RESOLVED);
    expect(s.session).toBe(fakeSession);
  });

  // The case that makes deleting getSession() safe: a signed-out cold start gets
  // INITIAL_SESSION with `null`, which is a real answer. Without it the app
  // would sit on the restoring screen forever.
  it('resolves hydration on a null INITIAL_SESSION rather than staying stuck', () => {
    useAuthStore.getState().setSession(null);

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.RESOLVED);
    expect(s.isLoading).toBe(false);
  });

  it('ignores a timer that fires after INITIAL_SESSION has landed', () => {
    useAuthStore.getState().setSession(fakeSession);
    useAuthStore.getState().markHydrationUnresolved();

    expect(useAuthStore.getState().hydration).toBe(AUTH_HYDRATION.RESOLVED);
  });

  // The recovery path: the timer wins the race, the rider sees the restoring
  // screen, and the late INITIAL_SESSION hands over to the real UI.
  it('recovers from UNRESOLVED when INITIAL_SESSION arrives late', () => {
    useAuthStore.getState().markHydrationUnresolved();
    expect(useAuthStore.getState().hydration).toBe(AUTH_HYDRATION.UNRESOLVED);

    useAuthStore.getState().setSession(fakeSession);

    const s = useAuthStore.getState();
    expect(s.hydration).toBe(AUTH_HYDRATION.RESOLVED);
    expect(s.session).toBe(fakeSession);
  });
});
