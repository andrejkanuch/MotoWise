import { describe, expect, it, vi } from 'vitest';
import { countryNameFromCode } from '../country-name';

describe('countryNameFromCode', () => {
  it('resolves a valid alpha-2 code to its English name', () => {
    expect(countryNameFromCode('DE')).toBe('Germany');
    expect(countryNameFromCode('FR')).toBe('France');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(countryNameFromCode('de')).toBe('Germany');
    expect(countryNameFromCode('  fr  ')).toBe('France');
  });

  it('returns null for non-well-formed input (never throws)', () => {
    expect(countryNameFromCode('USA')).toBeNull();
    expect(countryNameFromCode('1')).toBeNull();
    expect(countryNameFromCode('')).toBeNull();
    expect(countryNameFromCode('  ')).toBeNull();
  });

  it('returns null for placeholder / unassigned codes', () => {
    // ZZ is the CLDR "Unknown Region" placeholder.
    expect(countryNameFromCode('ZZ')).toBeNull();
    // Syntactically valid but unassigned — ICU echoes the input back.
    expect(countryNameFromCode('QX')).toBeNull();
  });

  it('degrades to null (no crash) on runtimes without Intl.DisplayNames', async () => {
    // Regression guard: some Hermes builds ship without Intl.DisplayNames.
    // Importing this module (re-exported from the @motovault/types barrel) must
    // never throw, and the function must degrade gracefully. We reset the module
    // so the lazy init runs again with the API stubbed out.
    vi.resetModules();
    const original = Intl.DisplayNames;
    // @ts-expect-error — intentionally removing the API to simulate Hermes
    Intl.DisplayNames = undefined;
    try {
      const { countryNameFromCode: fn } = await import('../country-name');
      expect(fn('DE')).toBeNull();
      expect(fn('USA')).toBeNull();
    } finally {
      Intl.DisplayNames = original;
      vi.resetModules();
    }
  });
});
