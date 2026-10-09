// Verifies the single-in-flight refresh dedupe (MOT-263): a burst of concurrent
// UNAUTHENTICATED retries must collapse to ONE supabase.auth.refreshSession call.

const mockRefresh = jest.fn();
const mockGetSession = jest.fn();

jest.mock('../supabase', () => ({
  supabase: { auth: { refreshSession: () => mockRefresh(), getSession: () => mockGetSession() } },
}));

const mockAuthState: {
  locale: string;
  session: unknown;
  isLoading: boolean;
  hydration: AuthHydration;
} = {
  locale: 'en',
  session: null,
  isLoading: false,
  hydration: AUTH_HYDRATION.RESOLVED,
};
jest.mock('../../stores/auth.store', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));

import { AUTH_HYDRATION, type AuthHydration } from '../auth-hydration';
import {
  buildGqlRequestHeaders,
  hasAuthenticatedSession,
  invalidateGqlAccessTokenCache,
  refreshGqlSession,
} from '../gql-auth-session';

beforeEach(() => {
  mockRefresh.mockReset();
  mockGetSession.mockReset();
  invalidateGqlAccessTokenCache();
  mockAuthState.session = null;
  mockAuthState.isLoading = false;
  mockAuthState.hydration = AUTH_HYDRATION.RESOLVED;
});

describe('refreshGqlSession (in-flight dedupe)', () => {
  it('collapses concurrent refreshes into a single refreshSession call', async () => {
    let resolveRefresh: (v: unknown) => void = () => {};
    mockRefresh.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const all = Promise.all([refreshGqlSession(), refreshGqlSession(), refreshGqlSession()]);
    resolveRefresh({ data: { session: { access_token: 't', expires_at: 9_999_999_999 } } });

    expect(await all).toEqual([true, true, true]);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('allows a new refresh once the previous one settles', async () => {
    mockRefresh.mockResolvedValue({ data: { session: null } });

    await refreshGqlSession();
    await refreshGqlSession();

    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});

// gqlFetcher decides whether to retry an UNAUTHENTICATED request on this result.
// Reporting "refreshed" when no token came back is what produced the second
// header-less request in MOTO-VAULT-REACT-NATIVE-1J.
describe('refreshGqlSession (session outcome)', () => {
  it('reports true when a refreshed access token is available', async () => {
    mockRefresh.mockResolvedValue({
      data: { session: { access_token: 'fresh', expires_at: 9_999_999_999 } },
    });

    await expect(refreshGqlSession()).resolves.toBe(true);
  });

  it('reports false when there is no session to refresh', async () => {
    mockRefresh.mockResolvedValue({ data: { session: null } });

    await expect(refreshGqlSession()).resolves.toBe(false);
  });

  it('reports false when the session carries no access token', async () => {
    mockRefresh.mockResolvedValue({ data: { session: { expires_at: 9_999_999_999 } } });

    await expect(refreshGqlSession()).resolves.toBe(false);
  });

  it('reports false when refreshSession rejects (offline)', async () => {
    mockRefresh.mockRejectedValue(new Error('Network request failed'));

    await expect(refreshGqlSession()).resolves.toBe(false);
  });
});

describe('hasAuthenticatedSession', () => {
  it('is true with a session', () => {
    mockAuthState.session = { access_token: 't' };
    expect(hasAuthenticatedSession()).toBe(true);
  });

  it('is false when signed out and hydration has settled', () => {
    expect(hasAuthenticatedSession()).toBe(false);
  });

  // Fail-open: the store's session is null until the auth listener delivers
  // INITIAL_SESSION at boot, so a headless path in that window must not be
  // misread as "signed out".
  it('is true while auth is still hydrating', () => {
    mockAuthState.isLoading = true;
    expect(hasAuthenticatedSession()).toBe(true);
  });

  // BUG-4 Q1: the hydration timeout used to close this grace window with the
  // session still null, so a signed-in rider's CarPlay heads-up and widget sync
  // silently short-circuited as "signed out" on every slow cold start.
  it('is true when hydration timed out without an answer (UNRESOLVED)', () => {
    mockAuthState.isLoading = false;
    mockAuthState.hydration = AUTH_HYDRATION.UNRESOLVED;
    expect(hasAuthenticatedSession()).toBe(true);
  });

  it('is false once hydration RESOLVED with no session — that null is authoritative', () => {
    mockAuthState.isLoading = false;
    mockAuthState.hydration = AUTH_HYDRATION.RESOLVED;
    expect(hasAuthenticatedSession()).toBe(false);
  });
});

describe('buildGqlRequestHeaders token cache across an account switch', () => {
  const sessionWith = (token: string) => ({
    data: { session: { access_token: token, expires_at: 9_999_999_999 } },
  });

  it("does not cache the previous account's token read before the auth change", async () => {
    // A request starts reading account A's session; the auth callback switches to
    // B (invalidating the cache) before that read returns.
    let finishRead: (v: unknown) => void = () => {};
    mockGetSession.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRead = resolve;
      }),
    );
    const inFlight = buildGqlRequestHeaders();
    invalidateGqlAccessTokenCache();
    finishRead(sessionWith('token-a'));
    expect((await inFlight).Authorization).toBe('Bearer token-a');

    // The next request re-reads the session instead of reusing A's token.
    mockGetSession.mockResolvedValueOnce(sessionWith('token-b'));
    expect((await buildGqlRequestHeaders()).Authorization).toBe('Bearer token-b');
  });

  it('reuses the cached token when nothing changed', async () => {
    mockGetSession.mockResolvedValue(sessionWith('token-a'));
    await buildGqlRequestHeaders();
    await buildGqlRequestHeaders();
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });
});
