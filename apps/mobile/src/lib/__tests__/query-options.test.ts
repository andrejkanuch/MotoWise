// The `me` query is where a deleted account is noticed: NOT_FOUND must end the
// session (and still surface the error); every other failure must leave it alone.

const mockFetcher = jest.fn();
const mockSignOutGone = jest.fn();
const mockRequestUser = jest.fn();

jest.mock('../graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('../account-gone', () => ({
  // The real classification, without the module's store/Supabase imports.
  isAccountGoneError: (error: unknown) =>
    jest.requireActual('../graphql-errors').hasGraphQLCode(error, 'NOT_FOUND'),
  getRequestSessionUserId: () => mockRequestUser(),
  signOutGoneAccount: (...args: unknown[]) => mockSignOutGone(...args),
}));
jest.mock('../supabase', () => ({ supabase: { auth: {} } }));
jest.mock('../analytics', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }));
jest.mock('@motovault/graphql', () => ({
  MeDocument: 'ME_DOC',
  AllMaintenanceTasksDocument: 'TASKS_DOC',
}));

import { meOptions } from '../query-options';

function gqlError(code: string) {
  return Object.assign(new Error('graphql error'), {
    response: { errors: [{ message: 'x', extensions: { code } }] },
  });
}

// biome-ignore lint/style/noNonNullAssertion: meOptions always defines queryFn
const runMe = () => (meOptions().queryFn as unknown as () => Promise<unknown>)!();

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestUser.mockReturnValue('user-a');
});

describe('meOptions queryFn', () => {
  it('returns the user on success without signing out', async () => {
    mockFetcher.mockResolvedValue({ me: { id: 'u1' } });
    await expect(runMe()).resolves.toEqual({ me: { id: 'u1' } });
    expect(mockSignOutGone).not.toHaveBeenCalled();
  });

  it('signs out once and rethrows when the account is gone (NOT_FOUND)', async () => {
    const error = gqlError('NOT_FOUND');
    // The session user is captured BEFORE the request: a switch while it is in
    // flight must not redirect the sign-out to the new account.
    mockRequestUser.mockReturnValueOnce('user-a').mockReturnValue('user-b');
    mockFetcher.mockRejectedValue(error);
    await expect(runMe()).rejects.toBe(error);
    expect(mockSignOutGone).toHaveBeenCalledTimes(1);
    // Bound to the session that sent the request, not whoever is signed in later.
    expect(mockSignOutGone).toHaveBeenCalledWith('user-a');
  });

  it.each([
    ['a server error', gqlError('INTERNAL_SERVER_ERROR')],
    ['an expired session', gqlError('UNAUTHENTICATED')],
    ['a network failure', new Error('Network request failed')],
  ])('keeps the session on %s', async (_label, error) => {
    mockFetcher.mockRejectedValue(error);
    await expect(runMe()).rejects.toBe(error);
    expect(mockSignOutGone).not.toHaveBeenCalled();
  });

  it('passes no user when the request carried no session (nothing to sign out)', async () => {
    mockRequestUser.mockReturnValue(null);
    mockFetcher.mockRejectedValue(gqlError('NOT_FOUND'));
    await expect(runMe()).rejects.toBeTruthy();
    expect(mockSignOutGone).toHaveBeenCalledWith(null);
  });
});
