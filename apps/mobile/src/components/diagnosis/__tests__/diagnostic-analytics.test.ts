// Issue 365 T05b (FS-PO2b): `diagnostic_failed` carries a typed `reason` and the
// seconds since the submit tap, never the server's text.

const mockTrackEvent = jest.fn();
jest.mock('@/lib/analytics', () => ({
  AnalyticsEvent: { DIAGNOSTIC_FAILED: 'diagnostic_failed' },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
jest.mock('@/lib/meta-analytics', () => ({ MetaAnalytics: { trackStartDiagnostic: jest.fn() } }));

import { GqlRequestTimeoutError } from '@/lib/graphql-error-classification';
import {
  classifyDiagnosticFailure,
  diagnoseListEntry,
  elapsedSeconds,
  parseDiagnosticEntry,
  trackDiagnosticFailed,
} from '../diagnostic-analytics';

/** A graphql-request ClientError shape with one error carrying `code`. */
const gqlError = (code: string, message = 'Raw server text with details') =>
  Object.assign(new Error(message), {
    response: { errors: [{ message, extensions: { code } }] },
  });

describe('classifyDiagnosticFailure', () => {
  it.each([
    ['the client deadline', new GqlRequestTimeoutError(60_000, 'SubmitDiagnostic'), 'timeout'],
    ['the OS request timeout', new Error('The request timed out.'), 'timeout'],
    [
      'the OS request timeout through expo/fetch',
      new Error('fetch failed: The request timed out.'),
      'timeout',
    ],
    ['no connection', new TypeError('Network request failed'), 'offline'],
    ['a dropped connection', new Error('The network connection was lost.'), 'offline'],
    ['the rate limit', gqlError('TOO_MANY_REQUESTS'), 'throttled'],
    ['the monthly limit for a rider the client took for Pro', gqlError('FORBIDDEN'), 'limit'],
    ['a server error', gqlError('INTERNAL_SERVER_ERROR'), 'server'],
    ['an error without a code', new Error('Something odd'), 'server'],
    ['a non-error value', 'boom', 'server'],
  ])('maps %s to "%s"', (_label, error, reason) => {
    expect(classifyDiagnosticFailure(error)).toBe(reason);
  });
});

describe('trackDiagnosticFailed', () => {
  it('sends the reason, elapsed seconds and the legacy offline flag — nothing from the message', () => {
    jest.spyOn(Date, 'now').mockReturnValue(47_340);

    trackDiagnosticFailed(gqlError('INTERNAL_SERVER_ERROR', 'secret prompt text'), 0);

    expect(mockTrackEvent).toHaveBeenCalledWith('diagnostic_failed', {
      reason: 'server',
      elapsed_s: 47.3,
      offline: false,
      precheck: false,
    });
    expect(JSON.stringify(mockTrackEvent.mock.calls)).not.toContain('secret');
  });
});

describe('elapsedSeconds', () => {
  it('rounds to one decimal', () => {
    expect(elapsedSeconds(1_000, 3_449)).toBe(2.4);
    expect(elapsedSeconds(1_000, 1_000)).toBe(0);
  });
});

describe('entry params', () => {
  it('accepts only known entries', () => {
    expect(parseDiagnosticEntry('detail')).toBe('detail');
    expect(parseDiagnosticEntry('anything')).toBeUndefined();
    expect(parseDiagnosticEntry(['list'])).toBeUndefined();
  });

  it('counts the list Start as home_tool only when Home opened the list', () => {
    expect(diagnoseListEntry('home_tool')).toBe('home_tool');
    expect(diagnoseListEntry(undefined)).toBe('list');
    expect(diagnoseListEntry('detail')).toBe('list');
  });
});
