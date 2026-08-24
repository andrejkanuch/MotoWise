jest.mock('../analytics', () => ({ captureException: jest.fn() }));
jest.mock('../logger', () => ({
  logger: { log: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { captureException } from '../analytics';
import {
  bestEffortNativeCall,
  isNativeTeardownError,
  NativeSideEffect,
} from '../best-effort-native';

const mockCaptureException = captureException as jest.MockedFunction<typeof captureException>;

/**
 * Reproduces what expo-modules-core throws in JS: a `CodedError` whose message
 * is the Kotlin `FunctionCallException` wrapper and whose `code` is inherited
 * from the cause (`DecoratedException` passes `cause.code` through).
 */
function codedError(functionName: string, cause: string, code: string): Error & { code: string } {
  const error = new Error(
    `Call to function '${functionName}' has been rejected.\n→ Caused by: ${cause}`,
  ) as Error & { code: string };
  error.code = code;
  return error;
}

/** The exact two variants grouped under Sentry MOTO-VAULT-REACT-NATIVE-19. */
const SYSTEM_UI_REJECTION = codedError(
  'ExpoSystemUI.setBackgroundColorAsync',
  'The current activity is no longer available',
  'ERR_MISSING_ACTIVITY',
);
const KEEP_AWAKE_REJECTION = codedError(
  'ExpoKeepAwake.deactivate',
  'The current activity is no longer available',
  'ERR_MISSING_ACTIVITY',
);

describe('isNativeTeardownError', () => {
  it.each([
    SYSTEM_UI_REJECTION,
    KEEP_AWAKE_REJECTION,
  ])('detects the production rejection %#', (error) => {
    expect(isNativeTeardownError(error)).toBe(true);
  });

  it.each([
    'ERR_MISSING_ACTIVITY',
    'ERR_MISSING_ROOT_VIEW',
    'ERR_REACT_CONTEXT_LOST',
    'ERR_APP_CONTEXT_LOST',
  ])('detects %s by code even when the message is unrecognized', (code) => {
    const error = new Error('some unfamiliar wrapper text') as Error & { code: string };
    error.code = code;
    expect(isNativeTeardownError(error)).toBe(true);
  });

  it.each([
    'The current activity is no longer available',
    'The root view is missing',
    'The react context has been lost',
    'The app context has been lost',
  ])('detects %j by message when the code is missing', (message) => {
    expect(isNativeTeardownError(new Error(message))).toBe(true);
  });

  it('accepts a raw message string (Sentry beforeSend only has the message)', () => {
    expect(isNativeTeardownError(SYSTEM_UI_REJECTION.message)).toBe(true);
  });

  it('does not flag genuine native failures', () => {
    // Same wrapper, different cause — a real bug that must stay visible.
    expect(
      isNativeTeardownError(
        codedError(
          'ExpoKeepAwake.activate',
          'Unable to activate keep awake',
          'ERR_ACTIVATE_KEEP_AWAKE',
        ),
      ),
    ).toBe(false);
    expect(isNativeTeardownError(new Error('Cannot read property of undefined'))).toBe(false);
    expect(isNativeTeardownError(undefined)).toBe(false);
    expect(isNativeTeardownError(null)).toBe(false);
  });

  it('ignores a non-string code without throwing', () => {
    const error = new Error('unrelated') as Error & { code: number };
    error.code = 42;
    expect(isNativeTeardownError(error)).toBe(false);
  });
});

describe('bestEffortNativeCall', () => {
  beforeEach(() => {
    mockCaptureException.mockClear();
  });

  it('resolves and reports nothing when the call succeeds', async () => {
    const call = jest.fn().mockResolvedValue(undefined);
    await expect(
      bestEffortNativeCall(NativeSideEffect.KEEP_AWAKE_ACTIVATE, call),
    ).resolves.toBeUndefined();
    expect(call).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it.each([
    [NativeSideEffect.SYSTEM_UI_ROOT_BACKGROUND, SYSTEM_UI_REJECTION],
    [NativeSideEffect.KEEP_AWAKE_DEACTIVATE, KEEP_AWAKE_REJECTION],
  ])('swallows the teardown rejection for %s', async (effect, rejection) => {
    await expect(
      bestEffortNativeCall(effect, () => Promise.reject(rejection)),
    ).resolves.toBeUndefined();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('still reports an unexpected rejection, tagged with the call site', async () => {
    const unexpected = new Error('boom');
    await expect(
      bestEffortNativeCall(NativeSideEffect.KEEP_AWAKE_ACTIVATE, () => Promise.reject(unexpected)),
    ).resolves.toBeUndefined();
    expect(mockCaptureException).toHaveBeenCalledWith(unexpected, {
      source: 'bestEffortNativeCall:keepAwake.activateKeepAwakeAsync',
    });
  });

  it('catches a synchronous throw (unlinked module → UnavailabilityError)', async () => {
    const unavailable = new Error(
      'The method or property ExpoKeepAwake.activate is not available on android',
    ) as Error & { code: string };
    unavailable.code = 'ERR_UNAVAILABLE';
    await expect(
      bestEffortNativeCall(NativeSideEffect.KEEP_AWAKE_ACTIVATE, () => {
        throw unavailable;
      }),
    ).resolves.toBeUndefined();
    expect(mockCaptureException).toHaveBeenCalledWith(unavailable, {
      source: 'bestEffortNativeCall:keepAwake.activateKeepAwakeAsync',
    });
  });

  it('never produces an unhandled rejection when the caller ignores the result', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      // Exactly how the call sites invoke it: floating, nothing awaits it.
      bestEffortNativeCall(NativeSideEffect.SYSTEM_UI_ROOT_BACKGROUND, () =>
        Promise.reject(SYSTEM_UI_REJECTION),
      );
      // Two macrotask turns: one for the rejection, one for Node to decide it
      // was unhandled.
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
