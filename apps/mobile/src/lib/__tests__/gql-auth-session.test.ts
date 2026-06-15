// Verifies the single-in-flight refresh dedupe (MOT-263): a burst of concurrent
// UNAUTHENTICATED retries must collapse to ONE supabase.auth.refreshSession call.

const mockRefresh = jest.fn();

jest.mock('../supabase', () => ({
  supabase: { auth: { refreshSession: () => mockRefresh() } },
}));

jest.mock('../../stores/auth.store', () => ({
  useAuthStore: { getState: () => ({ locale: 'en' }) },
}));

import { refreshGqlSession } from '../gql-auth-session';

beforeEach(() => {
  mockRefresh.mockReset();
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
    await all;

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('allows a new refresh once the previous one settles', async () => {
    mockRefresh.mockResolvedValue({ data: { session: null } });

    await refreshGqlSession();
    await refreshGqlSession();

    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });
});
