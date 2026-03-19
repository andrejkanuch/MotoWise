jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import i18n from '../i18n';
import de from '../i18n/locales/de.json';
import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import hi from '../i18n/locales/hi.json';
import id from '../i18n/locales/id.json';
import itLocale from '../i18n/locales/it.json';
import ja from '../i18n/locales/ja.json';
import pl from '../i18n/locales/pl.json';
import ptBR from '../i18n/locales/pt-BR.json';
import sk from '../i18n/locales/sk.json';
import th from '../i18n/locales/th.json';
import tr from '../i18n/locales/tr.json';

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      return getKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

const LOCALE_MAP: Record<string, Record<string, unknown>> = {
  es,
  de,
  fr,
  it: itLocale,
  'pt-BR': ptBR,
  ja,
  hi,
  th,
  id,
  tr,
  pl,
  sk,
};

describe('i18n', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('initializes with English as fallback', () => {
    expect(i18n.language).toBe('en');
  });

  // Test all locales have the same keys as English
  const enKeys = getKeys(en as unknown as Record<string, unknown>);

  for (const [locale, translations] of Object.entries(LOCALE_MAP)) {
    it(`all translation keys exist in ${locale}`, () => {
      const localeKeys = getKeys(translations as Record<string, unknown>);
      const missingKeys = enKeys.filter((key) => !localeKeys.includes(key));
      expect(missingKeys).toEqual([]);
    });
  }

  it('can switch language to Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(i18n.t('auth.signIn')).toBe('Iniciar Sesión');
  });

  it('can switch language to German', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.t('auth.signIn')).toBe('Anmelden');
  });

  it('falls back to English for missing keys', async () => {
    const originalEs = i18n.getResourceBundle('es', 'translation');
    const modifiedEs = JSON.parse(JSON.stringify(originalEs));
    delete modifiedEs.auth.signIn;
    i18n.removeResourceBundle('es', 'translation');
    i18n.addResourceBundle('es', 'translation', modifiedEs);

    await i18n.changeLanguage('es');
    expect(i18n.t('auth.signIn')).toBe('Sign In');

    i18n.removeResourceBundle('es', 'translation');
    i18n.addResourceBundle('es', 'translation', originalEs);
  });

  it('interpolation works', () => {
    const result = i18n.t('learn.articlePrefix', { slug: 'test' });
    expect(result).toContain('test');
  });
});
