import { describe, expect, it } from 'vitest';
import { SupportedLocaleSchema } from '../locale';

describe('SupportedLocaleSchema', () => {
  it('accepts valid locales', () => {
    expect(SupportedLocaleSchema.parse('en')).toBe('en');
    expect(SupportedLocaleSchema.parse('es')).toBe('es');
    expect(SupportedLocaleSchema.parse('de')).toBe('de');
  });

  it('rejects invalid locales', () => {
    expect(() => SupportedLocaleSchema.parse('fr')).toThrow();
    expect(() => SupportedLocaleSchema.parse('xyz')).toThrow();
    expect(() => SupportedLocaleSchema.parse('')).toThrow();
  });

  it('catch provides fallback', () => {
    const result = SupportedLocaleSchema.catch('en').parse('invalid');
    expect(result).toBe('en');
  });
});
