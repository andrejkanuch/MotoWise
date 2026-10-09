// When `me` answers NOT_FOUND the session's account no longer exists; the app
// must end that session locally instead of stranding the rider on failing screens.

const mockSignOut = jest.fn();
const mockCaptureException = jest.fn();
const mockSession = { userId: 'user-a' as string | null };

jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: async () => ({
        data: { session: mockSession.userId ? { user: { id: mockSession.userId } } : null },
      }),
    },
  },
}));
jest.mock('../../stores/auth.store', () => ({
  useAuthStore: { getState: () => ({ session: { user: { id: 'user-a' } } }) },
}));
jest.mock('../analytics', () => ({
  addBreadcrumb: jest.fn(),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

import {
  ACCOUNT_GONE_CHECK_TIMEOUT_MS,
  getRequestSessionUserId,
  isAccountGoneError,
  signOutGoneAccount,
} from '../account-gone';

function clientError(code: string) {
  return Object.assign(new Error('graphql error'), {
    response: { errors: [{ message: 'x', extensions: { code } }] },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
  mockSession.userId = 'user-a';
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
    await signOutGoneAccount('user-a');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('is single-flight when several screens fail at once', async () => {
    await Promise.all([
      signOutGoneAccount('user-a'),
      signOutGoneAccount('user-a'),
      signOutGoneAccount('user-a'),
    ]);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('reports a failed sign-out without throwing', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('storage failed') });
    await expect(signOutGoneAccount('user-a')).resolves.toBeUndefined();
    expect(mockCaptureException).toHaveBeenCalled();
  });

  it('never signs out a different account that signed in after the request was sent', async () => {
    mockSession.userId = 'user-b';
    await signOutGoneAccount('user-a');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('does nothing when the request carried no session', async () => {
    await signOutGoneAccount(null);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("keeps a genuine NOT_FOUND for the current account separate from another account's stale check", async () => {
    // A's stale request is still checking (B is signed in) when B's own `me` fails.
    mockSession.userId = 'user-b';
    await Promise.all([signOutGoneAccount('user-a'), signOutGoneAccount('user-b')]);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('signOutGoneAccount bounds', () => {
  it('runs again for the same account once the previous check finished', async () => {
    mockSession.userId = 'user-b';
    await signOutGoneAccount('user-a'); // stale: no-op
    mockSession.userId = 'user-a';
    await signOutGoneAccount('user-a'); // genuine: signs out
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('a hung check does not block later checks for that account', async () => {
    jest.useFakeTimers();
    try {
      mockSignOut.mockReturnValueOnce(new Promise(() => {}));
      const hung = signOutGoneAccount('user-a');
      await jest.advanceTimersByTimeAsync(ACCOUNT_GONE_CHECK_TIMEOUT_MS);
      await hung;
      mockSignOut.mockResolvedValue({ error: null });
      await signOutGoneAccount('user-a');
      expect(mockSignOut).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('getRequestSessionUserId', () => {
  it("reads the auth store's session synchronously", () => {
    expect(getRequestSessionUserId()).toBe('user-a');
  });
});
