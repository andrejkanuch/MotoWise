// MOT-278: registerForPushNotifications is best-effort — it must early-exit on each
// guard (no permission, non-mobile platform, no projectId, no token) and never throw
// (errors are swallowed), only firing the mutation on the granted+token happy path.

const mockHasPermission = jest.fn();
const mockGetExpoPushToken = jest.fn();
const mockGqlFetcher = jest.fn();
const mockConfig = { projectId: 'proj-1' as string | undefined };

jest.mock('../notifications', () => ({
  hasNotificationPermission: () => mockHasPermission(),
}));
jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushToken(...args),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          get projectId() {
            return mockConfig.projectId;
          },
        },
      },
    },
  },
}));
jest.mock('../graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockGqlFetcher(...args),
}));
jest.mock('@motovault/graphql', () => ({
  RegisterPushTokenDocument: 'REGISTER_DOC',
  UnregisterPushTokenDocument: 'UNREGISTER_DOC',
}));
jest.mock('../logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
const mockTrackEvent = jest.fn();
const mockCaptureException = jest.fn();
jest.mock('../analytics', () => ({
  AnalyticsEvent: {
    PUSH_TOKEN_REGISTERED: 'push_token_registered',
    PUSH_TOKEN_REGISTRATION_FAILED: 'push_token_registration_failed',
  },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));
/** What the API answers to a successful RegisterPushToken. */
const REGISTERED = { registerPushToken: { success: true } };
const mockSession = { userId: 'user-a' as string | null };
const mockGetSession = jest.fn();
jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));
const sessionFor = (userId: string | null) => ({
  data: { session: userId ? { user: { id: userId } } : null },
});

import {
  registerForPushNotifications,
  SIGN_OUT_UNREGISTER_TIMEOUT_MS,
  unregisterPushTokenForSignOut,
} from '../push-token';

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.projectId = 'proj-1';
  mockSession.userId = 'user-a';
  mockGetSession.mockImplementation(async () => sessionFor(mockSession.userId));
  process.env.EXPO_OS = 'ios';
  mockHasPermission.mockResolvedValue(true);
  mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
  // clearAllMocks keeps implementations; reset the one a timeout test leaves hanging.
  mockGqlFetcher.mockResolvedValue(REGISTERED);
});

describe('registerForPushNotifications', () => {
  it('registers the token on the granted + mobile + projectId + token happy path', async () => {
    await registerForPushNotifications();
    expect(mockGqlFetcher).toHaveBeenCalledWith('REGISTER_DOC', {
      input: { token: 'ExponentPushToken[abc]', platform: 'ios' },
    });
  });

  it('no-ops when permission is not granted', async () => {
    mockHasPermission.mockResolvedValue(false);
    await registerForPushNotifications();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });

  // Note: the non-mobile-platform guard isn't unit-testable here — jest-expo inlines
  // process.env.EXPO_OS to 'ios' at transform time, so it can't be reassigned at runtime.

  it('no-ops when no EAS projectId is configured', async () => {
    mockConfig.projectId = undefined;
    await registerForPushNotifications();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });

  it('no-ops when no token is returned', async () => {
    mockGetExpoPushToken.mockResolvedValue({ data: undefined });
    await registerForPushNotifications();
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });

  it('swallows errors (never throws into the caller)', async () => {
    mockGetExpoPushToken.mockRejectedValue(new Error('native failure'));
    await expect(registerForPushNotifications()).resolves.toBeUndefined();
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });
});

// Android had no FCM config from July to 2026-11-12: getExpoPushTokenAsync threw on
// every device and a production no-op logger.warn hid it. Failures must be visible.
describe('registration reporting', () => {
  it('records a successful registration with its platform', async () => {
    await registerForPushNotifications();
    expect(mockTrackEvent).toHaveBeenCalledWith('push_token_registered', { platform: 'ios' });
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('reports a device-token failure to PostHog and Sentry', async () => {
    const err = Object.assign(new Error('Default FirebaseApp is not initialized'), {
      code: 'E_REGISTRATION_FAILED',
    });
    mockGetExpoPushToken.mockRejectedValue(err);
    await registerForPushNotifications();
    expect(mockTrackEvent).toHaveBeenCalledWith('push_token_registration_failed', {
      platform: 'ios',
      stage: 'device_token',
      error_code: 'E_REGISTRATION_FAILED',
    });
    expect(mockCaptureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ source: 'push-token-register', stage: 'device_token' }),
    );
  });

  it('reports a claim that throws', async () => {
    mockGqlFetcher.mockRejectedValue(new Error('Internal server error'));
    await registerForPushNotifications();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'push_token_registration_failed',
      expect.objectContaining({ stage: 'claim', error_code: 'Error' }),
    );
    expect(mockTrackEvent).not.toHaveBeenCalledWith('push_token_registered', expect.anything());
  });

  it('labels an offline claim as a network failure, not a setup failure', async () => {
    mockGqlFetcher.mockRejectedValue(new TypeError('Network request failed'));
    await registerForPushNotifications();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'push_token_registration_failed',
      expect.objectContaining({ stage: 'claim', error_code: 'network' }),
    );
  });

  it('reports a claim the API refused, and does not remember its token', async () => {
    await unregisterPushTokenForSignOut(); // forget any token an earlier test remembered
    jest.clearAllMocks();
    mockGqlFetcher.mockResolvedValue({ registerPushToken: { success: false } });
    await registerForPushNotifications();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'push_token_registration_failed',
      expect.objectContaining({ stage: 'claim_rejected' }),
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);

    mockGetExpoPushToken.mockClear();
    await unregisterPushTokenForSignOut();
    expect(mockGetExpoPushToken).toHaveBeenCalled(); // nothing was remembered to reuse
  });

  it('stays quiet when nobody is signed in yet (sign-in registers again)', async () => {
    mockGqlFetcher.mockRejectedValue({ isMissingGqlSession: true });
    await registerForPushNotifications();
    expect(mockTrackEvent).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});

describe('unregisterPushTokenForSignOut', () => {
  it('removes the token this runtime registered, without asking Expo again', async () => {
    await registerForPushNotifications();
    mockGetExpoPushToken.mockClear();
    mockGqlFetcher.mockClear();

    await unregisterPushTokenForSignOut();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
    expect(mockGqlFetcher).toHaveBeenCalledWith('UNREGISTER_DOC', {
      input: { token: 'ExponentPushToken[abc]' },
    });
  });

  it('asks Expo for the token when this runtime never registered one', async () => {
    await unregisterPushTokenForSignOut();
    expect(mockGqlFetcher).toHaveBeenCalledWith('UNREGISTER_DOC', {
      input: { token: 'ExponentPushToken[abc]' },
    });
  });

  it('no-ops without notification permission', async () => {
    mockHasPermission.mockResolvedValue(false);
    await unregisterPushTokenForSignOut();
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });

  it('swallows a failed unregister (sign-out must continue)', async () => {
    mockGqlFetcher.mockRejectedValue(new Error('network down'));
    await expect(unregisterPushTokenForSignOut()).resolves.toBeUndefined();
  });

  it('gives up after the timeout instead of blocking sign-out', async () => {
    jest.useFakeTimers();
    try {
      mockGqlFetcher.mockReturnValue(new Promise(() => {}));
      const done = unregisterPushTokenForSignOut();
      await jest.advanceTimersByTimeAsync(SIGN_OUT_UNREGISTER_TIMEOUT_MS);
      await expect(done).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('skips when nobody is signed in (the mutation could only be rejected)', async () => {
    mockSession.userId = null;
    await unregisterPushTokenForSignOut();
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });

  it("never removes the NEXT account's token when it finishes late", async () => {
    // Account A signs out; the token lookup outlives the sign-out cap, and by the
    // time it resolves account B is signed in and has claimed the token.
    let resolveToken: (v: { data: string }) => void = () => {};
    mockGetExpoPushToken.mockReturnValue(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );
    const done = unregisterPushTokenForSignOut();
    await Promise.resolve();
    mockSession.userId = 'user-b';
    resolveToken({ data: 'ExponentPushToken[abc]' });
    await done;
    await new Promise((r) => setImmediate(r));
    expect(mockGqlFetcher).not.toHaveBeenCalled();
  });

  it('never removes the token the SAME rider re-claimed after signing back in', async () => {
    let resolveToken: (v: { data: string }) => void = () => {};
    mockGetExpoPushToken.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );
    const done = unregisterPushTokenForSignOut();
    // Let the unregister reach its (still pending) token lookup.
    await new Promise((r) => setImmediate(r));
    // Signed out, then back in as the same user: the auth listener registers again.
    await registerForPushNotifications();
    mockGqlFetcher.mockClear();
    resolveToken({ data: 'ExponentPushToken[abc]' });
    await done;
    await new Promise((r) => setImmediate(r));
    expect(mockGqlFetcher).not.toHaveBeenCalledWith('UNREGISTER_DOC', expect.anything());
  });

  it('does not claim the token back when Log out starts during the token lookup', async () => {
    let resolveToken: (v: { data: string }) => void = () => {};
    mockGetExpoPushToken.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveToken = resolve;
      }),
    );
    const registering = registerForPushNotifications();
    await new Promise((r) => setImmediate(r));
    const signingOut = unregisterPushTokenForSignOut();
    resolveToken({ data: 'ExponentPushToken[abc]' });
    await Promise.all([registering, signingOut]);
    expect(mockGqlFetcher).not.toHaveBeenCalledWith('REGISTER_DOC', expect.anything());
  });

  it('lets a registration that starts during the final session read win', async () => {
    // Second getSession (the late check) is held open while the rider signs back in.
    let releaseCheck: () => void = () => {};
    mockGetSession
      .mockImplementationOnce(async () => sessionFor('user-a'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseCheck = () => resolve(sessionFor('user-a'));
          }),
      );
    const signingOut = unregisterPushTokenForSignOut();
    await new Promise((r) => setImmediate(r));
    await registerForPushNotifications();
    mockGqlFetcher.mockClear();
    releaseCheck();
    await signingOut;
    expect(mockGqlFetcher).not.toHaveBeenCalledWith('UNREGISTER_DOC', expect.anything());
  });

  it('orders the unregister after a claim that is already on the wire', async () => {
    const order: string[] = [];
    let landClaim: () => void = () => {};
    mockGqlFetcher.mockImplementation((doc: string) => {
      if (doc === 'REGISTER_DOC') {
        return new Promise((resolve) => {
          landClaim = () => {
            order.push('register');
            resolve(REGISTERED);
          };
        });
      }
      order.push('unregister');
      return Promise.resolve({});
    });
    const registering = registerForPushNotifications();
    await new Promise((r) => setImmediate(r)); // claim sent, response pending
    const signingOut = unregisterPushTokenForSignOut();
    await new Promise((r) => setImmediate(r));
    expect(order).toEqual([]); // unregister waits for the claim
    landClaim();
    await Promise.all([registering, signingOut]);
    expect(order).toEqual(['register', 'unregister']);
  });

  it('does not wait on a registration that has not sent its claim yet', async () => {
    // The registration is stuck in its token lookup; sign-out must not spend its
    // budget waiting for it (it will see the generation bump and never send).
    mockGetExpoPushToken.mockReturnValueOnce(new Promise(() => {}));
    void registerForPushNotifications();
    await new Promise((r) => setImmediate(r));
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    await unregisterPushTokenForSignOut();
    expect(mockGqlFetcher).toHaveBeenCalledWith('UNREGISTER_DOC', {
      input: { token: 'ExponentPushToken[abc]' },
    });
  });

  it('waits for every claim already on the wire, not only the latest', async () => {
    const order: string[] = [];
    const lands: Array<() => void> = [];
    mockGqlFetcher.mockImplementation((doc: string) => {
      if (doc === 'REGISTER_DOC') {
        return new Promise((resolve) => {
          const n = lands.length + 1;
          lands.push(() => {
            order.push(`register-${n}`);
            resolve(REGISTERED);
          });
        });
      }
      order.push('unregister');
      return Promise.resolve({});
    });
    // Each claim is sent before the next registration starts (e.g. launch, then
    // SIGNED_IN), so both are on the wire at once.
    const first = registerForPushNotifications();
    await new Promise((r) => setImmediate(r));
    const second = registerForPushNotifications();
    await new Promise((r) => setImmediate(r));
    expect(lands).toHaveLength(2);
    const signingOut = unregisterPushTokenForSignOut();
    await new Promise((r) => setImmediate(r));
    lands[1]();
    await new Promise((r) => setImmediate(r));
    expect(order).toEqual(['register-2']); // still waiting for the older claim
    lands[0]();
    await Promise.all([first, second, signingOut]);
    expect(order).toEqual(['register-2', 'register-1', 'unregister']);
  });

  it('a claim landing after Log out started does not leave its token remembered', async () => {
    let landClaim: () => void = () => {};
    mockGqlFetcher.mockImplementation((doc: string) =>
      doc === 'REGISTER_DOC'
        ? new Promise((resolve) => {
            landClaim = () => resolve(REGISTERED);
          })
        : Promise.resolve({}),
    );
    const registering = registerForPushNotifications();
    await new Promise((r) => setImmediate(r)); // claim sent with token abc
    mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[fresh]' });
    const signingOut = unregisterPushTokenForSignOut();
    await new Promise((r) => setImmediate(r));
    landClaim();
    await Promise.all([registering, signingOut]);

    // The next sign-out looks the token up again instead of reusing the stale one.
    mockGqlFetcher.mockClear();
    await unregisterPushTokenForSignOut();
    expect(mockGqlFetcher).toHaveBeenCalledWith('UNREGISTER_DOC', {
      input: { token: 'ExponentPushToken[fresh]' },
    });
  });

  it('remembers the older claim when a newer overlapping registration sends nothing', async () => {
    let landClaim: () => void = () => {};
    mockGqlFetcher.mockImplementation((doc: string) =>
      doc === 'REGISTER_DOC'
        ? new Promise((resolve) => {
            landClaim = () => resolve(REGISTERED);
          })
        : Promise.resolve({}),
    );
    const older = registerForPushNotifications();
    await new Promise((r) => setImmediate(r)); // older claim on the wire (token abc)
    mockHasPermission.mockResolvedValue(false); // permission revoked: the newer one sends nothing
    await registerForPushNotifications();
    landClaim();
    await older;

    mockGqlFetcher.mockClear();
    await unregisterPushTokenForSignOut(); // no permission, so it cannot look the token up again
    expect(mockGqlFetcher).toHaveBeenCalledWith('UNREGISTER_DOC', {
      input: { token: 'ExponentPushToken[abc]' },
    });
  });
});
