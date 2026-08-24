import * as SecureStore from 'expo-secure-store';
import { AppState, type NativeEventSubscription } from 'react-native';

// -------------------------------------------------------------------
// The app's single entry point to the keychain.
// -------------------------------------------------------------------
// Two production failures this module exists to prevent (Sentry
// MOTO-VAULT-REACT-NATIVE-2D, 18 users, and -2N on the write path):
//
//   Error: FunctionCallException: Calling the 'getValueWithKeyAsync' function
//   has failed → Caused by: KeyChainException: User interaction is not allowed.
//
//  1. WRONG ACCESSIBILITY. expo-secure-store stores items with iOS's default
//     `kSecAttrAccessibleWhenUnlocked`, which is unreadable while the screen is
//     locked. Several of our reads run from the background — the Supabase
//     `TOKEN_REFRESHED` handler, the pending-intent reader on cold start, the
//     persisted-query cache buster — which is exactly when the phone is locked
//     (every reported event carried `in_foreground: false`). Everything written
//     through this module carries AFTER_FIRST_UNLOCK, which stays readable in
//     the background once the rider has unlocked the device since boot, while
//     still being protected across a reboot.
//
//  2. HARD FAILURE. A locked keychain is an expected condition, not a bug. No
//     operation here throws: each one resolves with a status that tells a
//     locked device (`locked`) apart from a real fault (`failed`), so callers
//     can degrade or defer instead of filling Sentry with noise.
//
// Deliberately dependency-light: `analytics` → `meta-attribution` → this
// module, so importing `analytics` back would close a require cycle at module
// init. Sentry reporting stays with the callers.
// -------------------------------------------------------------------

/**
 * iOS keychain accessibility levels. `keychainAccessible` is an iOS-only
 * option; on Android the platform keystore has no equivalent attribute.
 */
export const KEYCHAIN_ACCESSIBILITY = {
  /**
   * Readable once the device has been unlocked at least once since boot —
   * including while the screen is locked. Required for any background read.
   */
  AFTER_FIRST_UNLOCK: SecureStore.AFTER_FIRST_UNLOCK,
  /** expo-secure-store's default: readable only while actively unlocked. */
  WHEN_UNLOCKED: SecureStore.WHEN_UNLOCKED,
} as const;

export type KeychainAccessibility =
  (typeof KEYCHAIN_ACCESSIBILITY)[keyof typeof KEYCHAIN_ACCESSIBILITY];

/** Options every write goes out with. */
const WRITE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: KEYCHAIN_ACCESSIBILITY.AFTER_FIRST_UNLOCK,
};

/**
 * Every keychain key the app owns. Supabase Auth owns its own key names
 * (`sb-<ref>-auth-token`, the PKCE verifier) and passes them straight through
 * `secureStoreAuthAdapter`, so they are intentionally absent here — they still
 * get the same accessibility treatment.
 */
export const SECURE_STORE_KEY = {
  /** Last-known analytics consent, read synchronously at module load. */
  ANALYTICS_CONSENT: 'motovault.analytics-consent',
  /**
   * Signed-in user id, the persisted-query cache buster + sign-out signal.
   *
   * MUST stay in SecureStore, and MUST keep the same accessibility as the
   * Supabase session. `decideAuthStateChange` derives `shouldClearLocalData`
   * from `hasPersistedUser` (this key, via `getLastUserId`) OR'd with the
   * in-session ref, while `sessionUserId` comes from `secureStoreAuthAdapter`.
   * The two signals must fail and succeed TOGETHER.
   *
   * That is precisely what was broken: this key already carried
   * AFTER_FIRST_UNLOCK (from the -21 fix) while the auth token was still
   * WHEN_UNLOCKED, so a locked background launch read a persisted user but no
   * session — `shouldClearLocalData: true`, wiping the query cache,
   * notifications and widgets for a rider who was never signed out. Both now
   * write through WRITE_OPTIONS, so both are readable after first unlock, and
   * before first unlock they fail together and degrade to "anonymous
   * first-launch visitor", which clears nothing.
   *
   * So: do not move this key to MMKV/AsyncStorage (no locked-device failure
   * mode) and do not give it a different `keychainAccessible`. Either one
   * re-opens the divergence above.
   * (Sentry MOTO-VAULT-REACT-NATIVE-2D / -2N / -21)
   */
  LAST_USER_ID: 'motovault.last-user-id',
  /** Per-install encryption key for the offline-trips MMKV store. */
  OFFLINE_MMKV_KEY: 'motovault.offline.mmkv.key.v1',
  /** One-shot flag: the web→app intent transport was consumed this install. */
  PENDING_INTENT_CHECKED: 'pending_intent_checked',
  META_FBCLID: 'meta_fbclid',
  META_UTM_SOURCE: 'meta_utm_source',
  META_UTM_CONTENT: 'meta_utm_content',
  META_UTM_CAMPAIGN: 'meta_utm_campaign',
  META_CAPTURED: 'meta_captured',
  META_FIRST_SEEN_AT: 'meta_first_seen_at',
  META_INSTALL_VERSION: 'meta_install_version',
} as const;

export type SecureStoreKey = (typeof SECURE_STORE_KEY)[keyof typeof SECURE_STORE_KEY];

export const SECURE_STORE_STATUS = {
  OK: 'ok',
  /** The keychain refused access because the device is locked — expected. */
  LOCKED: 'locked',
  /** Anything else: module unavailable, undecodable item, keychain fault. */
  FAILED: 'failed',
} as const;

export type SecureStoreStatus = (typeof SECURE_STORE_STATUS)[keyof typeof SECURE_STORE_STATUS];

export interface SecureStoreResult {
  status: SecureStoreStatus;
  /** The stored value on a successful read; always null on write/delete/failure. */
  value: string | null;
  /** The underlying error, for callers that want to report a `failed` status. */
  error?: unknown;
}

/**
 * Messages the platforms use when they refuse keychain access because the
 * device is locked. `errSecInteractionNotAllowed` is -25308; Expo composes the
 * native cause into the JS error message, so substring matching is enough.
 */
const LOCKED_ERROR_SIGNATURES = [
  'user interaction is not allowed',
  'interactionnotallowed',
  '-25308',
  'user not authenticated',
] as const;

/** True when a keychain failure is just "the device is locked". */
export function isKeychainLockedError(error: unknown): boolean {
  const cause = error instanceof Error ? (error.cause ?? '') : '';
  const haystack =
    `${error instanceof Error ? error.message : String(error)} ${String(cause)}`.toLowerCase();
  return LOCKED_ERROR_SIGNATURES.some((signature) => haystack.includes(signature));
}

function toFailure(error: unknown): SecureStoreResult {
  return {
    status: isKeychainLockedError(error) ? SECURE_STORE_STATUS.LOCKED : SECURE_STORE_STATUS.FAILED,
    value: null,
    error,
  };
}

// -------------------------------------------------------------------
// Raw operations — the only place expo-secure-store is called. Each one
// converts a throw into a status; none of them ever reject.
// -------------------------------------------------------------------

async function rawRead(key: string): Promise<SecureStoreResult> {
  try {
    return { status: SECURE_STORE_STATUS.OK, value: (await SecureStore.getItemAsync(key)) ?? null };
  } catch (error) {
    return toFailure(error);
  }
}

function rawReadSync(key: string): SecureStoreResult {
  try {
    return { status: SECURE_STORE_STATUS.OK, value: SecureStore.getItem(key) ?? null };
  } catch (error) {
    return toFailure(error);
  }
}

async function rawWrite(key: string, value: string): Promise<SecureStoreResult> {
  try {
    await SecureStore.setItemAsync(key, value, WRITE_OPTIONS);
    return { status: SECURE_STORE_STATUS.OK, value: null };
  } catch (error) {
    return toFailure(error);
  }
}

function rawWriteSync(key: string, value: string): SecureStoreResult {
  try {
    SecureStore.setItem(key, value, WRITE_OPTIONS);
    return { status: SECURE_STORE_STATUS.OK, value: null };
  } catch (error) {
    return toFailure(error);
  }
}

async function rawDelete(key: string): Promise<SecureStoreResult> {
  try {
    await SecureStore.deleteItemAsync(key);
    return { status: SECURE_STORE_STATUS.OK, value: null };
  } catch (error) {
    return toFailure(error);
  }
}

// -------------------------------------------------------------------
// One-time accessibility upgrade for items written by an older build.
// -------------------------------------------------------------------
// `keychainAccessible` only applies to the item being written, so shipping the
// option is not enough: every rider who already has a token, a consent flag or
// an attribution value on disk keeps the old WHEN_UNLOCKED attribute.
//
// Worse, expo's native `set` does `SecItemAdd` and, on errSecDuplicateItem,
// falls back to `SecItemUpdate` with kSecValueData ONLY — the existing item's
// kSecAttrAccessible is never touched (see SecureStoreModule.swift `update`).
// Deleting first forces the SecItemAdd path, which is the only way the new
// accessibility actually lands.
//
// So the first time this runtime touches a key we read it, rewrite it, and
// stamp a per-key marker so the rewrite happens exactly once per install. A
// locked or failed keychain leaves the marker unset and is retried later —
// never a hard failure. The rewrite is only ever reached after a SUCCESSFUL
// read, so the delete→add gap is a sub-millisecond window on a device that has
// demonstrably passed first unlock; for Supabase's keys the upgrade is awaited
// inside its own storage lock, so no concurrent read can observe the gap.
// -------------------------------------------------------------------

const MARKER_PREFIX = 'motovault.kc-accessible.';
const MARKER_VALUE = '1';
/** Attempts to re-add an item after the migration delete. */
const REWRITE_ATTEMPTS = 2;

/**
 * `keychainAccessible` is iOS-only, so there is nothing to upgrade elsewhere.
 * Uses EXPO_OS per the repo convention (never Platform.OS).
 */
const SUPPORTS_ACCESSIBILITY = process.env.EXPO_OS === 'ios';

/** Keys whose accessibility is settled for this runtime. */
const settledKeys = new Set<string>();

/** Delete + re-add so kSecAttrAccessible is actually applied. */
async function rewriteWithAccessibility(key: string, value: string): Promise<boolean> {
  await rawDelete(key);
  for (let attempt = 0; attempt < REWRITE_ATTEMPTS; attempt++) {
    if ((await rawWrite(key, value)).status === SECURE_STORE_STATUS.OK) return true;
  }
  return false;
}

/** Returns false when the upgrade could not be completed and must be retried. */
async function upgradeAccessibility(key: string): Promise<boolean> {
  const marker = await rawRead(`${MARKER_PREFIX}${key}`);
  if (marker.status !== SECURE_STORE_STATUS.OK) return false;
  if (marker.value === MARKER_VALUE) return true;

  const current = await rawRead(key);
  if (current.status !== SECURE_STORE_STATUS.OK) return false;
  // No item yet: nothing to rewrite. Stamp anyway — whatever we write later
  // goes through rawWrite, so it is created with the right accessibility.
  if (current.value !== null && !(await rewriteWithAccessibility(key, current.value))) return false;

  await rawWrite(`${MARKER_PREFIX}${key}`, MARKER_VALUE);
  return true;
}

async function ensureAccessible(key: string): Promise<void> {
  if (!SUPPORTS_ACCESSIBILITY || settledKeys.has(key)) return;
  // Claim the key before awaiting so concurrent callers cannot both migrate.
  settledKeys.add(key);
  if (!(await upgradeAccessibility(key))) settledKeys.delete(key);
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------

/** Read an item, reporting whether a miss was a genuine absence or a lock. */
export async function readSecureItem(key: string): Promise<SecureStoreResult> {
  await ensureAccessible(key);
  return rawRead(key);
}

/**
 * Synchronous read, for the handful of call sites that run at module load or
 * during render. The accessibility upgrade cannot be awaited here, so it runs
 * in the background and takes effect from the next launch.
 */
export function readSecureItemSync(key: string): SecureStoreResult {
  void ensureAccessible(key);
  return rawReadSync(key);
}

export async function writeSecureItem(key: string, value: string): Promise<SecureStoreResult> {
  await ensureAccessible(key);
  return rawWrite(key, value);
}

export function writeSecureItemSync(key: string, value: string): SecureStoreResult {
  void ensureAccessible(key);
  return rawWriteSync(key, value);
}

export async function removeSecureItem(key: string): Promise<SecureStoreResult> {
  return rawDelete(key);
}

/** Read an item, treating a locked or broken keychain as "no value". */
export async function getSecureItem(key: string): Promise<string | null> {
  return (await readSecureItem(key)).value;
}

/** Synchronous {@link getSecureItem}. */
export function getSecureItemSync(key: string): string | null {
  return readSecureItemSync(key).value;
}

/** Write an item; returns false when the keychain was locked or unavailable. */
export async function setSecureItem(key: string, value: string): Promise<boolean> {
  return (await writeSecureItem(key, value)).status === SECURE_STORE_STATUS.OK;
}

/** Synchronous {@link setSecureItem}. */
export function setSecureItemSync(key: string, value: string): boolean {
  return writeSecureItemSync(key, value).status === SECURE_STORE_STATUS.OK;
}

/** Delete an item; returns false when the keychain was locked or unavailable. */
export async function deleteSecureItem(key: string): Promise<boolean> {
  return (await removeSecureItem(key)).status === SECURE_STORE_STATUS.OK;
}

/**
 * Supabase Auth `storage` adapter. Supabase serialises its own storage access,
 * so awaiting the accessibility upgrade in here keeps the delete→add gap
 * invisible to every other Supabase read.
 */
export const secureStoreAuthAdapter = {
  getItem: (key: string): Promise<string | null> => getSecureItem(key),
  setItem: async (key: string, value: string): Promise<void> => {
    await setSecureItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await deleteSecureItem(key);
  },
};

// -------------------------------------------------------------------
// Deferring work until the device is unlocked
// -------------------------------------------------------------------

const APP_STATE_ACTIVE = 'active';
/** Foreground retries granted to a deferred keychain task before giving up. */
const MAX_UNLOCK_RETRIES = 3;

/**
 * Runs `task` now and, when it reports it could not complete (resolved false,
 * typically because the keychain was locked), runs it again the next few times
 * the app is foregrounded — the point at which the device is unlocked.
 *
 * Resolves as soon as the FIRST attempt settles, so a locked device never
 * blocks the caller; later retries are fire-and-forget.
 */
export async function runWithUnlockRetry(task: () => Promise<boolean>): Promise<void> {
  if (await task()) return;

  let attempts = 0;
  let subscription: NativeEventSubscription | null = null;
  const stop = () => {
    subscription?.remove();
    subscription = null;
  };

  subscription = AppState.addEventListener('change', (state) => {
    if (state !== APP_STATE_ACTIVE) return;
    attempts += 1;
    if (attempts >= MAX_UNLOCK_RETRIES) stop();
    void task().then((done) => {
      if (done) stop();
    });
  });
}
