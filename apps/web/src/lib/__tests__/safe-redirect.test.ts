import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '../safe-redirect';

describe('safeRedirectPath', () => {
  it('allows internal app paths', () => {
    expect(safeRedirectPath('/garage')).toBe('/garage');
    expect(safeRedirectPath('/trips/abc?foo=bar')).toBe('/trips/abc?foo=bar');
  });

  it('falls back for null/empty/missing values', () => {
    expect(safeRedirectPath(null)).toBe('/garage');
    expect(safeRedirectPath(undefined)).toBe('/garage');
    expect(safeRedirectPath('')).toBe('/garage');
  });

  it('honors a custom fallback', () => {
    expect(safeRedirectPath(null, '/login')).toBe('/login');
    expect(safeRedirectPath('https://evil.com', '/login')).toBe('/login');
  });

  it('rejects absolute and scheme URLs', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/garage');
    expect(safeRedirectPath('http://evil.com/path')).toBe('/garage');
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/garage');
    expect(safeRedirectPath('mailto:x@y.z')).toBe('/garage');
  });

  it('rejects protocol-relative and backslash tricks', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/garage');
    expect(safeRedirectPath('/\\evil.com')).toBe('/garage');
  });

  it('rejects control characters the URL parser strips (tab/newline open redirect)', () => {
    // `?redirect=/%09/evil.com` decodes to a tab; a browser strips it and
    // navigates to //evil.com.
    expect(new URLSearchParams('redirect=/%09/evil.com').get('redirect')).toBe('/\t/evil.com');
    for (const value of [
      '/\t/evil.com',
      '/\n/evil.com',
      '/\r/evil.com',
      '/\t\\evil.com',
      '/\u0000/evil.com',
      '/garage\u007F',
      '/foo\\bar',
    ]) {
      expect(safeRedirectPath(value)).toBe('/garage');
    }
  });

  it('still allows percent-encoded paths that stay on-site', () => {
    expect(safeRedirectPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
    expect(safeRedirectPath('/trips/a%20b#top')).toBe('/trips/a%20b#top');
  });

  it('rejects bare hosts with no leading slash', () => {
    expect(safeRedirectPath('evil.com')).toBe('/garage');
  });
});
