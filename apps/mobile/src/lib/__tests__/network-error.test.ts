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
});
