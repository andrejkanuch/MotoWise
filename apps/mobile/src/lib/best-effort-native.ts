/**
 * Best-effort wrapper for fire-and-forget calls into Expo native modules.
 *
 * Every Expo `AsyncFunction` returns a promise, and on Android a call that
 * lands after its host has been torn down rejects instead of resolving. The
 * Kotlin bridge wraps the cause as
 * `Call to function '<Module>.<fn>' has been rejected. → Caused by: <cause>`
 * and re-throws it in JS as a `CodedError` carrying the cause's `code`
 * (see expo-modules-core `CodedException.inferCode`). Nobody is awaiting a
 * cosmetic side effect, so the rejection escapes as an `onunhandledrejection`
 * and Sentry files it as an error — 53 events across the 3.17/3.19 releases,
 * all on Android, all after hours of uptime.
 * (Sentry MOTO-VAULT-REACT-NATIVE-19)
 *
 * The teardown race itself is expected and harmless: the Activity that the
 * side effect would have touched no longer exists, so there is nothing to fix
 * and nothing to report. Anything else is a real failure and still reaches
 * Sentry, so this is not a blanket `.catch(() => {})`.
 */
import { captureException } from './analytics';
import { logger } from './logger';

/**
 * `code` values Expo attaches when the host that owns a native call is already
 * gone — Android backgrounding, a configuration change, process death, or a
 * headless/background JS runtime that has no Activity at all. Sourced from
 * expo-modules-core `Exceptions` (`MissingActivity`, `MissingRootView`,
 * `ReactContextLost`, `AppContextLost`); the code is inferred from the
 * exception class name, so it is stable across SDK versions.
 */
const NATIVE_TEARDOWN_ERROR_CODES: readonly string[] = [
  'ERR_MISSING_ACTIVITY',
  'ERR_MISSING_ROOT_VIEW',
  'ERR_REACT_CONTEXT_LOST',
  'ERR_APP_CONTEXT_LOST',
];

/**
 * Message fallback for the same four exceptions, matched against the lowercased
 * message. The `code` check above is the primary signal; these cover paths that
 * lose it — a rejection re-wrapped as a plain `Error`, or a message string
 * reaching us without the original object (e.g. from Sentry's `beforeSend`).
 * The strings are hard-coded English in expo-modules-core, never localized.
 */
const NATIVE_TEARDOWN_MESSAGES: readonly string[] = [
  'the current activity is no longer available',
  'the root view is missing',
  'the react context has been lost',
  'the app context has been lost',
];

/** Reads a string `code` off an unknown thrown value without asserting a shape. */
function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

/**
 * Accepts an Error, a `CodedError`, or a raw message string — `beforeSend` only
 * ever has the message.
 */
export function isNativeTeardownError(error: unknown): boolean {
  const code = codeOf(error);
  if (code && NATIVE_TEARDOWN_ERROR_CODES.includes(code)) return true;

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return NATIVE_TEARDOWN_MESSAGES.some((needle) => message.includes(needle));
}

/**
 * Identifies the side effect in dev logs and in the Sentry context of a
 * genuinely unexpected failure. Values are `<module>.<function>` so a Sentry
 * event points straight at the native call, not at this wrapper.
 */
export const NativeSideEffect = {
  SYSTEM_UI_ROOT_BACKGROUND: 'systemUI.setBackgroundColorAsync',
  KEEP_AWAKE_ACTIVATE: 'keepAwake.activateKeepAwakeAsync',
  KEEP_AWAKE_DEACTIVATE: 'keepAwake.deactivateKeepAwake',
} as const;

export type NativeSideEffectLabel = (typeof NativeSideEffect)[keyof typeof NativeSideEffect];

/**
 * Runs a native side effect whose result nobody consumes.
 *
 * The returned promise NEVER rejects, so callers can leave it floating — that
 * is the point, and it is what keeps the teardown race out of
 * `onunhandledrejection`. Tests can await it to observe the outcome.
 *
 * Synchronous throws are caught too: an unlinked module throws
 * `UnavailabilityError` before any promise exists.
 */
export async function bestEffortNativeCall(
  effect: NativeSideEffectLabel,
  call: () => Promise<unknown> | unknown,
): Promise<void> {
  try {
    await call();
  } catch (error) {
    if (isNativeTeardownError(error)) {
      logger.debug(`[native] ${effect} skipped — host was already torn down`, error);
      return;
    }
    captureException(error, { source: `bestEffortNativeCall:${effect}` });
  }
}
