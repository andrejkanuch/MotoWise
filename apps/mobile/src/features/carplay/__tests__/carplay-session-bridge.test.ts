import type { Session } from '@supabase/supabase-js';

type AuthListener = (event: string, session: Session | null) => void;

const mockUnsubscribe = jest.fn();
let mockAuthListener: AuthListener | null = null;
const mockOnAuthStateChange = jest.fn((listener: AuthListener) => {
  mockAuthListener = listener;
  return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: (listener: AuthListener) => mockOnAuthStateChange(listener) },
  },
}));
jest.mock('@/lib/gql-auth-session', () => ({ invalidateGqlAccessTokenCache: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ captureException: jest.fn() }));
jest.mock('@/utils/ride-sync-queue', () => ({ drainQueue: jest.fn(() => Promise.resolve()) }));

const mockAuthState: { session: Session | null; setSession: jest.Mock } = {
  session: null,
  setSession: jest.fn((session: Session | null) => {
    mockAuthState.session = session;
  }),
};
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: () => mockAuthState },
}));

import { captureException } from '@/lib/analytics';
import { invalidateGqlAccessTokenCache } from '@/lib/gql-auth-session';
import { drainQueue } from '@/utils/ride-sync-queue';
import { __resetCarPlaySessionBridge, startCarPlaySessionBridge } from '../carplay-session-bridge';

const session = (userId: string, token: string) =>
  ({ user: { id: userId }, access_token: token }) as unknown as Session;

const emit = (event: string, value: Session | null) => {
  if (!mockAuthListener) throw new Error('bridge not started');
  mockAuthListener(event, value);
};

describe('CarPlay session bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetCarPlaySessionBridge();
    mockAuthListener = null;
    mockAuthState.session = null;
  });

  it('puts the restored session in the auth store and restarts ride delivery', () => {
    const onSession = jest.fn();
    startCarPlaySessionBridge(onSession);

    emit('INITIAL_SESSION', session('rider-1', 'token-1'));

    expect(mockAuthState.setSession).toHaveBeenCalledWith(session('rider-1', 'token-1'));
    expect(invalidateGqlAccessTokenCache).toHaveBeenCalledTimes(1);
    expect(drainQueue).toHaveBeenCalledTimes(1);
    expect(onSession).toHaveBeenCalledTimes(1);
  });

  it('subscribes once however many times a head unit connects', () => {
    startCarPlaySessionBridge(jest.fn());
    startCarPlaySessionBridge(jest.fn());
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('leaves the store alone when the root layout already wrote the same session', () => {
    mockAuthState.session = session('rider-1', 'token-1');
    startCarPlaySessionBridge(jest.fn());

    emit('INITIAL_SESSION', session('rider-1', 'token-1'));

    expect(mockAuthState.setSession).not.toHaveBeenCalled();
    expect(drainQueue).not.toHaveBeenCalled();
  });

  it('picks up a refreshed token', () => {
    mockAuthState.session = session('rider-1', 'token-1');
    startCarPlaySessionBridge(jest.fn());

    emit('TOKEN_REFRESHED', session('rider-1', 'token-2'));

    expect(mockAuthState.setSession).toHaveBeenCalledWith(session('rider-1', 'token-2'));
    expect(drainQueue).toHaveBeenCalledTimes(1);
  });

  it('switches accounts: the new rider is in the store before anything drains', () => {
    mockAuthState.session = session('rider-a', 'token-a');
    startCarPlaySessionBridge(jest.fn());
    (drainQueue as jest.Mock).mockImplementationOnce(() => {
      // The ownership guard reads the store at drain time.
      expect(mockAuthState.session?.user.id).toBe('rider-b');
      return Promise.resolve();
    });

    emit('SIGNED_OUT', null);
    expect(drainQueue).not.toHaveBeenCalled();
    emit('SIGNED_IN', session('rider-b', 'token-b'));

    expect(mockAuthState.session).toEqual(session('rider-b', 'token-b'));
    expect(drainQueue).toHaveBeenCalledTimes(1);
  });

  it('replaces a different rider without a sign-out in between', () => {
    mockAuthState.session = session('rider-a', 'token-a');
    startCarPlaySessionBridge(jest.fn());

    emit('SIGNED_IN', session('rider-b', 'token-a'));

    expect(mockAuthState.setSession).toHaveBeenCalledWith(session('rider-b', 'token-a'));
  });

  it('mirrors a sign-out without draining', () => {
    mockAuthState.session = session('rider-1', 'token-1');
    const onSession = jest.fn();
    startCarPlaySessionBridge(onSession);

    emit('SIGNED_OUT', null);

    expect(mockAuthState.setSession).toHaveBeenCalledWith(null);
    expect(drainQueue).not.toHaveBeenCalled();
    expect(onSession).not.toHaveBeenCalled();
  });

  it('reports a drain that rejects instead of leaving it unhandled', async () => {
    const failure = new Error('drain failed');
    (drainQueue as jest.Mock).mockReturnValueOnce(Promise.reject(failure));
    startCarPlaySessionBridge(jest.fn());

    emit('INITIAL_SESSION', session('rider-1', 'token-1'));
    await Promise.resolve();

    expect(captureException).toHaveBeenCalledWith(failure, {
      source: 'carplay-session-bridge.drain',
    });
  });

  it('does nothing for a signed-out launch', () => {
    startCarPlaySessionBridge(jest.fn());
    emit('INITIAL_SESSION', null);
    expect(mockAuthState.setSession).not.toHaveBeenCalled();
  });
});
