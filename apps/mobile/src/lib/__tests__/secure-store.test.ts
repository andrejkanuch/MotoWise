// A fake keychain that models the two iOS behaviours the wrapper exists for:
//
//  1. An item stored with WHEN_UNLOCKED is unreadable while the device is
//     locked — `SecItemCopyMatching` returns errSecInteractionNotAllowed and
//     expo-secure-store surfaces it as a thrown FunctionCallException.
//  2. expo's native `set` only applies `kSecAttrAccessible` on the SecItemAdd
//     path; for an existing item it falls back to SecItemUpdate with
//     kSecValueData only, leaving the old accessibility in place.
//
// The tests are written against that fake so they assert real behaviour rather
// than call counts. Helpers touched by the jest.mock factory must be
// `mock`-prefixed — jest forbids other out-of-scope references.

const mockAccessibility = { AFTER_FIRST_UNLOCK: 1, WHEN_UNLOCKED: 5 } as const;

interface KeychainEntry {
  value: string;
  accessible: number;
}

const mockKeychain = new Map<string, KeychainEntry>();
let mockDeviceLocked = false;

function mockLockedError(fn: string): Error {
  return new Error(
    `FunctionCallException: Calling the '${fn}' function has failed ` +
      '(at ExpoModulesCore/AsyncFunctionDefinition.swift:123)\n' +
      '→ Caused by: KeyChainException: User interaction is not allowed. ' +
      '(at ExpoSecureStore/SecureStoreModule.swift:168)',
  );
}

/** Readable unless the device is locked and the item demands WHEN_UNLOCKED. */
function mockIsReachable(entry: KeychainEntry): boolean {
  return !mockDeviceLocked || entry.accessible === mockAccessibility.AFTER_FIRST_UNLOCK;
}

function mockRead(key: string, fn: string): string | null {
  const entry = mockKeychain.get(key);
  // A missing item is errSecItemNotFound even on a locked device.
  if (!entry) return null;
  if (!mockIsReachable(entry)) throw mockLockedError(fn);
  return entry.value;
}

function mockWrite(
  key: string,
  value: string,
  options: { keychainAccessible?: number } | undefined,
  fn: string,
): void {
  const existing = mockKeychain.get(key);
  // SecItemAdd → errSecDuplicateItem → SecItemUpdate: data only, and the
  // update itself needs the item to be reachable.
  if (existing) {
    if (!mockIsReachable(existing)) throw mockLockedError(fn);
    mockKeychain.set(key, { value, accessible: existing.accessible });
    return;
  }
  mockKeychain.set(key, {
    value,
    accessible: options?.keychainAccessible ?? mockAccessibility.WHEN_UNLOCKED,
  });
}

// The two constants are inlined rather than read off `mockAccessibility`: the
// factory is hoisted above every `const` in this file, so touching one here
// would hit its temporal dead zone.
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 1,
  WHEN_UNLOCKED: 5,
  getItemAsync: jest.fn(async (key: string) => mockRead(key, 'getValueWithKeyAsync')),
  getItem: jest.fn((key: string) => mockRead(key, 'getValueWithKeySync')),
  setItemAsync: jest.fn(
    async (key: string, value: string, options?: { keychainAccessible?: number }) =>
      mockWrite(key, value, options, 'setValueWithKeyAsync'),
  ),
  setItem: jest.fn((key: string, value: string, options?: { keychainAccessible?: number }) =>
    mockWrite(key, value, options, 'setValueWithKeySync'),
  ),
  deleteItemAsync: jest.fn(async (key: string) => {
    // expo ignores the OSStatus of SecItemDelete, so this never throws.
    mockKeychain.delete(key);
  }),
}));

import * as SecureStore from 'expo-secure-store';
import { AppState, type AppStateStatus } from 'react-native';

const mockedSecureStore = jest.mocked(SecureStore);

/** AppState handlers registered by `runWithUnlockRetry`. */
let appStateHandlers: Array<(state: AppStateStatus) => void> = [];

type SecureStoreModule = typeof import('../secure-store');

/** Fresh module instance so the per-runtime `settledKeys` set starts empty. */
function loadModule(): SecureStoreModule {
  let mod: SecureStoreModule | undefined;
  jest.isolateModules(() => {
    mod = require('../secure-store');
  });
  // biome-ignore lint/style/noNonNullAssertion: assigned synchronously above
  return mod!;
}

/** Seed an item exactly as a pre-fix build of the app would have written it. */
function seedLegacyItem(key: string, value: string): void {
  mockKeychain.set(key, { value, accessible: mockAccessibility.WHEN_UNLOCKED });
}

/** Simulate the app being foregrounded (which implies an unlocked device). */
async function foregroundApp(): Promise<void> {
  for (const handler of [...appStateHandlers]) handler('active');
  // Let the retry's promise chain settle.
  await Promise.resolve();
  await Promise.resolve();
}

const KEY = 'motovault.test-key';

beforeEach(() => {
  mockKeychain.clear();
  mockDeviceLocked = false;
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    const typed = handler as (state: AppStateStatus) => void;
    appStateHandlers.push(typed);
    return {
      remove: () => {
        appStateHandlers = appStateHandlers.filter((h) => h !== typed);
      },
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('isKeychainLockedError', () => {
  it('recognises the iOS locked-device keychain failure', () => {
    const { isKeychainLockedError } = loadModule();
    expect(isKeychainLockedError(mockLockedError('getValueWithKeyAsync'))).toBe(true);
    expect(isKeychainLockedError(new Error('errSecInteractionNotAllowed'))).toBe(true);
    expect(isKeychainLockedError(new Error('KeyChainException: -25308'))).toBe(true);
  });

  it('does not misclassify unrelated failures', () => {
    const { isKeychainLockedError } = loadModule();
    // Other OSStatus values expo maps in KeyChainException — real faults.
    expect(isKeychainLockedError(new Error('Unable to decode the provided data.'))).toBe(false);
    expect(isKeychainLockedError(new Error('Authentication failed.'))).toBe(false);
    expect(isKeychainLockedError(undefined)).toBe(false);
  });

  // Sentry's `beforeSend` only sees the serialized exception VALUE, never the
  // Error object, so the classifier has to accept a bare message string too.
  it('classifies a bare message string, as Sentry beforeSend passes it', () => {
    const { isKeychainLockedError } = loadModule();
    expect(isKeychainLockedError(mockLockedError('getValueWithKeyAsync').message)).toBe(true);
    expect(isKeychainLockedError('Unable to find viewState for tag')).toBe(false);
  });
});

describe('writes', () => {
  it('stores new items with AFTER_FIRST_UNLOCK so background reads work', async () => {
    const { setSecureItem } = loadModule();

    await expect(setSecureItem(KEY, 'value')).resolves.toBe(true);

    expect(mockKeychain.get(KEY)).toEqual({
      value: 'value',
      accessible: mockAccessibility.AFTER_FIRST_UNLOCK,
    });
  });

  it('reports a locked keychain instead of throwing (MOTO-VAULT-REACT-NATIVE-2N)', async () => {
    const { writeSecureItem, SECURE_STORE_STATUS } = loadModule();
    seedLegacyItem(KEY, 'old');
    mockDeviceLocked = true;

    const result = await writeSecureItem(KEY, 'new');

    expect(result.status).toBe(SECURE_STORE_STATUS.LOCKED);
    expect(mockKeychain.get(KEY)?.value).toBe('old');
  });
});

describe('reads', () => {
  it('resolves null with a LOCKED status rather than throwing', async () => {
    const { readSecureItem, getSecureItem, SECURE_STORE_STATUS } = loadModule();
    seedLegacyItem(KEY, 'value');
    mockDeviceLocked = true;

    await expect(readSecureItem(KEY)).resolves.toMatchObject({
      status: SECURE_STORE_STATUS.LOCKED,
      value: null,
    });
    await expect(getSecureItem(KEY)).resolves.toBeNull();
  });

  it('distinguishes a locked keychain from a genuinely absent item', async () => {
    const { readSecureItem, SECURE_STORE_STATUS } = loadModule();
    mockDeviceLocked = true;

    // Nothing stored → a definitive "no value", not a lock.
    await expect(readSecureItem(KEY)).resolves.toMatchObject({
      status: SECURE_STORE_STATUS.OK,
      value: null,
    });
  });

  it('never throws on a synchronous read', () => {
    const { readSecureItemSync, SECURE_STORE_STATUS } = loadModule();
    seedLegacyItem(KEY, 'value');
    mockDeviceLocked = true;

    expect(readSecureItemSync(KEY).status).toBe(SECURE_STORE_STATUS.LOCKED);
  });
});

describe('accessibility upgrade for items written by an older build', () => {
  it('rewrites a WHEN_UNLOCKED item so it survives a locked device', async () => {
    const { getSecureItem } = loadModule();
    seedLegacyItem(KEY, 'value');

    // First touch while unlocked performs the upgrade.
    await expect(getSecureItem(KEY)).resolves.toBe('value');
    expect(mockKeychain.get(KEY)).toEqual({
      value: 'value',
      accessible: mockAccessibility.AFTER_FIRST_UNLOCK,
    });

    // Which is the whole point: the same read now works with the screen locked.
    mockDeviceLocked = true;
    await expect(getSecureItem(KEY)).resolves.toBe('value');
  });

  it('runs the rewrite once per install, not on every read', async () => {
    const secureStore = loadModule();
    seedLegacyItem(KEY, 'value');
    await secureStore.getSecureItem(KEY);
    mockedSecureStore.deleteItemAsync.mockClear();

    // A fresh runtime (new module instance) must find the marker and skip.
    const nextLaunch = loadModule();
    await expect(nextLaunch.getSecureItem(KEY)).resolves.toBe('value');
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('leaves the value intact and retries later when the device is locked', async () => {
    const secureStore = loadModule();
    seedLegacyItem(KEY, 'value');
    mockDeviceLocked = true;

    await expect(secureStore.getSecureItem(KEY)).resolves.toBeNull();
    // Not marked as migrated, and nothing was destroyed.
    expect(mockKeychain.get(KEY)).toEqual({
      value: 'value',
      accessible: mockAccessibility.WHEN_UNLOCKED,
    });

    // Same runtime, device now unlocked: the upgrade is retried.
    mockDeviceLocked = false;
    await expect(secureStore.getSecureItem(KEY)).resolves.toBe('value');
    expect(mockKeychain.get(KEY)?.accessible).toBe(mockAccessibility.AFTER_FIRST_UNLOCK);
  });
});

describe('secureStoreAuthAdapter', () => {
  it('satisfies the Supabase storage contract without throwing when locked', async () => {
    const { secureStoreAuthAdapter } = loadModule();
    const authKey = 'sb-abcdefgh-auth-token';

    await secureStoreAuthAdapter.setItem(authKey, 'session');
    expect(mockKeychain.get(authKey)?.accessible).toBe(mockAccessibility.AFTER_FIRST_UNLOCK);
    await expect(secureStoreAuthAdapter.getItem(authKey)).resolves.toBe('session');

    await secureStoreAuthAdapter.removeItem(authKey);
    expect(mockKeychain.has(authKey)).toBe(false);
  });

  it('yields no session instead of throwing when the token is unreadable', async () => {
    const { secureStoreAuthAdapter } = loadModule();
    const authKey = 'sb-abcdefgh-auth-token';
    seedLegacyItem(authKey, 'legacy-session');
    mockDeviceLocked = true;

    await expect(secureStoreAuthAdapter.getItem(authKey)).resolves.toBeNull();
    expect(mockKeychain.get(authKey)?.value).toBe('legacy-session');
  });
});

describe('runWithUnlockRetry', () => {
  it('resolves immediately when the task succeeds and registers no listener', async () => {
    const { runWithUnlockRetry } = loadModule();
    const task = jest.fn().mockResolvedValue(true);

    await runWithUnlockRetry(task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(appStateHandlers).toHaveLength(0);
  });

  it('retries once the app is foregrounded, then unsubscribes', async () => {
    const { runWithUnlockRetry } = loadModule();
    const task = jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true);

    await runWithUnlockRetry(task);
    expect(appStateHandlers).toHaveLength(1);

    // A background transition must not retry.
    for (const handler of [...appStateHandlers]) handler('background');
    expect(task).toHaveBeenCalledTimes(1);

    await foregroundApp();

    expect(task).toHaveBeenCalledTimes(2);
    expect(appStateHandlers).toHaveLength(0);
  });

  it('gives up after a bounded number of foreground attempts', async () => {
    const { runWithUnlockRetry } = loadModule();
    const task = jest.fn().mockResolvedValue(false);

    await runWithUnlockRetry(task);
    for (let attempt = 0; attempt < 10; attempt++) await foregroundApp();

    expect(task.mock.calls.length).toBeLessThanOrEqual(4);
    expect(appStateHandlers).toHaveLength(0);
  });
});
