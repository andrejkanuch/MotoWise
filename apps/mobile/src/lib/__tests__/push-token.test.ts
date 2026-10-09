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

import {
  registerForPushNotifications,
  SIGN_OUT_UNREGISTER_TIMEOUT_MS,
  unregisterPushTokenForSignOut,
} from '../push-token';

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.projectId = 'proj-1';
  process.env.EXPO_OS = 'ios';
  mockHasPermission.mockResolvedValue(true);
  mockGetExpoPushToken.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
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
});
