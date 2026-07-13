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

  it('rejects bare hosts with no leading slash', () => {
    expect(safeRedirectPath('evil.com')).toBe('/garage');
  });
});
