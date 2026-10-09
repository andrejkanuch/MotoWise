// The `me` query is where a deleted account is noticed: NOT_FOUND must end the
// session (and still surface the error); every other failure must leave it alone.

const mockFetcher = jest.fn();
const mockSignOutGone = jest.fn();

jest.mock('../graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
jest.mock('../account-gone', () => ({
  ...jest.requireActual('../account-gone'),
  signOutGoneAccount: () => mockSignOutGone(),
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

beforeEach(() => jest.clearAllMocks());

describe('meOptions queryFn', () => {
  it('returns the user on success without signing out', async () => {
    mockFetcher.mockResolvedValue({ me: { id: 'u1' } });
    await expect(runMe()).resolves.toEqual({ me: { id: 'u1' } });
    expect(mockSignOutGone).not.toHaveBeenCalled();
  });

  it('signs out once and rethrows when the account is gone (NOT_FOUND)', async () => {
    const error = gqlError('NOT_FOUND');
    mockFetcher.mockRejectedValue(error);
    await expect(runMe()).rejects.toBe(error);
    expect(mockSignOutGone).toHaveBeenCalledTimes(1);
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
});
