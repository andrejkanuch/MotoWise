import { isNetworkError } from '../network-error';

describe('isNetworkError', () => {
  it.each([
    // expo/fetch FetchError prefix — reason text is OS-localized, prefix is stable
    'fetch failed: The Internet connection appears to be offline.',
    'fetch failed: cancelled',
    'fetch failed: A server with the specified hostname could not be found.',
    'fetch failed: La connexion réseau a été perdue.',
    'Network request failed',
    'The request timed out.',
    'Unable to resolve host "api.motovault.app"',
    // RevenueCat transient connectivity message (MOTO-VAULT-REACT-NATIVE-M)
    'Error performing request.',
  ])('detects %j as a transport failure', (msg) => {
    expect(isNetworkError(new Error(msg))).toBe(true);
  });

  it('matches case-insensitively (iOS capitalizes "The Internet connection…")', () => {
    expect(isNetworkError(new Error('The Internet connection appears to be offline.'))).toBe(true);
  });

  it('accepts raw message strings (sentryBeforeSend passes strings, not Errors)', () => {
    expect(isNetworkError('fetch failed: something')).toBe(true);
  });

  it('does not flag genuine application errors', () => {
    expect(isNetworkError(new Error('Cannot read property of undefined'))).toBe(false);
    expect(isNetworkError(new Error('GraphQL validation failed'))).toBe(false);
  });

  it('anchors the expo/fetch needle to the "fetch failed:" prefix (no bare-substring drop)', () => {
    // A genuine app error that merely contains the words "fetch failed" must NOT
    // be swallowed — only the `fetch failed: <reason>` transport format matches.
    expect(isNetworkError(new Error('Image prefetch failed to decode asset'))).toBe(false);
    expect(isNetworkError(new Error('data fetch failed validation'))).toBe(false);
    // Embedded-word form that DOES carry the `: <reason>` colon: a bare
    // `includes('fetch failed:')` check would match the "fetch failed:" inside
    // "prefetch failed:" and drop this real app error. The \b boundary rejects it.
    expect(isNetworkError(new Error('Image prefetch failed: unable to decode asset'))).toBe(false);
    // The genuine expo/fetch transport format at the start of the message still matches.
    expect(isNetworkError(new Error('fetch failed: connection reset'))).toBe(true);
  });
});
