// Verifies the single-in-flight refresh dedupe (MOT-263): a burst of concurrent
// UNAUTHENTICATED retries must collapse to ONE supabase.auth.refreshSession call.

const mockRefresh = jest.fn();

jest.mock('../supabase', () => ({
  supabase: { auth: { refreshSession: () => mockRefresh() } },
}));

const mockAuthState: { locale: string; session: unknown; isLoading: boolean } = {
  locale: 'en',
  session: null,
  isLoading: false,
};
jest.mock('../../stores/auth.store', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));

import { hasAuthenticatedSession, refreshGqlSession } from '../gql-auth-session';

beforeEach(() => {
  mockRefresh.mockReset();
  mockAuthState.session = null;
  mockAuthState.isLoading = false;
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

  // Fail-open: the store's session is null until getSession() resolves at boot,
  // so a headless path in that window must not be misread as "signed out".
  it('is true while auth is still hydrating', () => {
    mockAuthState.isLoading = true;
    expect(hasAuthenticatedSession()).toBe(true);
  });
});
