jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import i18n from '../i18n';
import de from '../i18n/locales/de.json';
import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

describe('i18n', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('initializes with English as fallback', () => {
    const validLocales = ['en', 'es', 'de'];
    expect(validLocales).toContain(i18n.language);
  });

  it('all translation keys exist in Spanish', () => {
    const enKeys = getKeys(en);
    const esKeys = getKeys(es);
    const missingKeys = enKeys.filter((key) => !esKeys.includes(key));
    expect(missingKeys).toEqual([]);
  });

  it('all translation keys exist in German', () => {
    const enKeys = getKeys(en);
    const deKeys = getKeys(de);
    const missingKeys = enKeys.filter((key) => !deKeys.includes(key));
    expect(missingKeys).toEqual([]);
  });

  it('can switch language to Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.t('auth.signIn')).toBe('Iniciar Sesion');
  });

  it('can switch language to German', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.t('auth.signIn')).toBe('Anmelden');
  });

  it('falls back to English for missing keys', async () => {
    const originalEs = i18n.getResourceBundle('es', 'translation');
    const modifiedEs = JSON.parse(JSON.stringify(originalEs));
    // Remove a key to simulate a missing translation
    delete modifiedEs.auth.signIn;
    i18n.removeResourceBundle('es', 'translation');
    i18n.addResourceBundle('es', 'translation', modifiedEs);

    await i18n.changeLanguage('es');
    expect(i18n.t('auth.signIn')).toBe('Sign In');

    // Restore original resource bundle
    i18n.removeResourceBundle('es', 'translation');
    i18n.addResourceBundle('es', 'translation', originalEs);
  });

  it('interpolation works', () => {
    const result = i18n.t('learn.articlePrefix', { slug: 'test' });
    expect(result).toContain('test');
  });
});
