// When `me` answers NOT_FOUND the session's account no longer exists; the app
// must end that session locally instead of stranding the rider on failing screens.

const mockSignOut = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('../supabase', () => ({
  supabase: { auth: { signOut: (...args: unknown[]) => mockSignOut(...args) } },
}));
jest.mock('../analytics', () => ({
  addBreadcrumb: jest.fn(),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import { isAccountGoneError, signOutGoneAccount } from '../account-gone';

function clientError(code: string) {
  return Object.assign(new Error('graphql error'), {
    response: { errors: [{ message: 'x', extensions: { code } }] },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
});

describe('isAccountGoneError', () => {
  it('is true only for NOT_FOUND', () => {
    expect(isAccountGoneError(clientError('NOT_FOUND'))).toBe(true);
    expect(isAccountGoneError(clientError('INTERNAL_SERVER_ERROR'))).toBe(false);
    expect(isAccountGoneError(clientError('UNAUTHENTICATED'))).toBe(false);
    expect(isAccountGoneError(new Error('Network request failed'))).toBe(false);
  });
});

describe('signOutGoneAccount', () => {
  it('signs out locally (the server has nothing left to revoke)', async () => {
    await signOutGoneAccount();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('is single-flight when several screens fail at once', async () => {
    await Promise.all([signOutGoneAccount(), signOutGoneAccount(), signOutGoneAccount()]);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('reports a failed sign-out without throwing', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('storage failed') });
    await expect(signOutGoneAccount()).resolves.toBeUndefined();
    expect(mockCaptureException).toHaveBeenCalled();
  });
});
