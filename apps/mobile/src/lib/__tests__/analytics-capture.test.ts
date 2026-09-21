// `captureException` only reaches Sentry when a DSN is configured, so unlike
// sentry-filters.test.ts this suite gives expo-constants a non-empty one.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  getClient: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  reactNavigationIntegration: jest.fn().mockReturnValue({}),
}));
jest.mock('expo-constants', () => ({
  expoConfig: { extra: { sentryDsn: 'https://test@sentry/1' } },
}));
jest.mock('posthog-react-native', () => jest.fn());
jest.mock('react-native-fbsdk-next', () => ({
  Settings: { setAdvertiserTrackingEnabled: jest.fn() },
}));
jest.mock('../meta-attribution', () => ({ getStoredUtmProperties: jest.fn() }));

import * as Sentry from '@sentry/react-native';
import { captureException, toCapturableError } from '../analytics';

const sentryCapture = Sentry.captureException as jest.Mock;

/** The exact payload expo-task-manager hands the background location task on
 *  kCLErrorDenied, as observed in MOTO-VAULT-REACT-NATIVE-2Z. */
const CORE_LOCATION_DENIED = {
  code: 1,
  message: 'Error Domain=kCLErrorDomain Code=1 "(null)"',
};
const RIDE_SOURCE = 'ride-location.backgroundLocationTask';

type CaptureContext = {
  extra?: Record<string, unknown>;
  fingerprint?: string[];
  tags?: Record<string, string>;
};

/** Reads the (value, captureContext) pair the SDK actually received. */
function lastCapture(): { value: unknown; context: CaptureContext } {
  const [value, context] = sentryCapture.mock.calls[sentryCapture.mock.calls.length - 1];
  return { value, context: context as CaptureContext };
}

beforeEach(() => {
  sentryCapture.mockClear();
});

describe('captureException — non-Error values', () => {
  it('wraps a plain object in a real Error carrying its message', () => {
    captureException(CORE_LOCATION_DENIED, { source: RIDE_SOURCE });

    const { value } = lastCapture();
    expect(value).toBeInstanceOf(Error);
    expect((value as Error).message).toBe('Error Domain=kCLErrorDomain Code=1 "(null)"');
  });

  it('carries the raw value in extra.originalValue alongside the caller context', () => {
    captureException(CORE_LOCATION_DENIED, { source: RIDE_SOURCE, rideId: 'ride-1' });

    const { context } = lastCapture();
    expect(context.extra).toEqual({
      source: RIDE_SOURCE,
      rideId: 'ride-1',
      originalValue: CORE_LOCATION_DENIED,
    });
  });

  // ANTI-REGRESSION: the wrapper Error's stack is rooted in analytics.ts, so
  // without an explicit fingerprint every wrapped capture across ~40 call sites
  // shares identical top in-app frames and Sentry can collapse them into one
  // issue. `{{ default }}` must stay out so the stack is overridden, not merged.
  it('pins grouping with an explicit fingerprint that omits {{ default }}', () => {
    captureException(CORE_LOCATION_DENIED, { source: RIDE_SOURCE });

    const { context } = lastCapture();
    expect(context.fingerprint).toEqual(['non-error', RIDE_SOURCE, 'code,message', '1']);
    expect(context.fingerprint).not.toContain('{{ default }}');
  });

  it('gives two different sources two different fingerprints', () => {
    captureException(CORE_LOCATION_DENIED, { source: 'a' });
    const first = lastCapture().context.fingerprint;
    captureException(CORE_LOCATION_DENIED, { source: 'b' });
    const second = lastCapture().context.fingerprint;

    expect(first).not.toEqual(second);
  });

  it('gives two different codes from one source two different fingerprints', () => {
    captureException({ code: 0, message: 'unknown' }, { source: RIDE_SOURCE });
    const first = lastCapture().context.fingerprint;
    captureException({ code: 1, message: 'denied' }, { source: RIDE_SOURCE });
    const second = lastCapture().context.fingerprint;

    expect(first).not.toEqual(second);
  });

  it('tags the real origin so triage survives the analytics.ts culprit line', () => {
    captureException(CORE_LOCATION_DENIED, { source: RIDE_SOURCE });

    expect(lastCapture().context.tags).toEqual({ 'capture.source': RIDE_SOURCE });
  });

  it.each([
    ['a string', 'a string', 'string'],
    [undefined, 'undefined', 'undefined'],
  ])('handles the primitive %p without throwing', (input, message, typeName) => {
    expect(() => captureException(input)).not.toThrow();

    const { value, context } = lastCapture();
    expect(value).toBeInstanceOf(Error);
    expect((value as Error).message).toBe(message);
    expect(context.fingerprint).toEqual(['non-error', 'unknown', typeName]);
  });

  it('falls back to the boundary key when no source is given', () => {
    captureException(CORE_LOCATION_DENIED, { boundary: 'root' });

    const { context } = lastCapture();
    expect(context.fingerprint).toEqual(['non-error', 'root', 'code,message', '1']);
    expect(context.tags).toEqual({ 'capture.source': 'root' });
  });
});

describe('captureException — real Errors', () => {
  it('passes a real Error through by identity so its stack survives', () => {
    const error = new Error('boom');
    captureException(error, { source: RIDE_SOURCE });

    const { value, context } = lastCapture();
    expect(value).toBe(error);
    expect(context.extra).toEqual({ source: RIDE_SOURCE });
    expect(context.extra).not.toHaveProperty('originalValue');
  });

  it('leaves default grouping alone — no fingerprint, no capture.source tag', () => {
    captureException(new Error('boom'), { source: RIDE_SOURCE });

    const { context } = lastCapture();
    expect(context.fingerprint).toBeUndefined();
    expect(context.tags).toBeUndefined();
  });
});

describe('toCapturableError', () => {
  it('returns a genuine Error unchanged', () => {
    const error = new Error('boom');
    expect(toCapturableError(error)).toBe(error);
  });

  it('attaches the original object as cause (bonus carrier for LinkedErrors)', () => {
    expect(toCapturableError(CORE_LOCATION_DENIED).cause).toBe(CORE_LOCATION_DENIED);
  });
});
