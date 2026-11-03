import { FALLBACK_NUMBER_LOCALE, numberLocaleFor } from '../number-locale';

describe('numberLocaleFor', () => {
  it('makes the app language regional with the device region', () => {
    expect(numberLocaleFor('es', 'CO')).toBe('es-CO');
    expect(numberLocaleFor('de', 'de')).toBe('de-DE');
    expect(numberLocaleFor('en', 'GB')).toBe('en-GB');
  });

  it('keeps a language that already names a region', () => {
    expect(numberLocaleFor('pt-BR', 'PT')).toBe('pt-BR');
  });

  it('uses the bare language when the region is missing or malformed', () => {
    expect(numberLocaleFor('fr', undefined)).toBe('fr');
    expect(numberLocaleFor('fr', '419')).toBe('fr');
  });

  it('falls back to en-US without a language', () => {
    expect(numberLocaleFor(undefined, 'CO')).toBe(FALLBACK_NUMBER_LOCALE);
    expect(numberLocaleFor('  ', 'CO')).toBe(FALLBACK_NUMBER_LOCALE);
  });
});
