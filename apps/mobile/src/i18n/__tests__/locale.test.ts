const mockDeviceLocales = jest.fn();
jest.mock('expo-localization', () => ({ getLocales: () => mockDeviceLocales() }));

import { SUPPORTED_LOCALES } from '@motovault/types';
import { APP_LOCALES } from '../../../app.config';
import i18n, { applyLocalePreference } from '..';
import { effectiveLocale, LOCALE_PREFERENCE, resolveDeviceLocale, toI18nLanguage } from '../locale';
import esES from '../locales/es-ES.json';

const device = (languageTag: string, regionCode: string | null = null) => ({
  languageTag,
  languageCode: languageTag.split('-')[0] ?? null,
  regionCode,
});

beforeEach(() => mockDeviceLocales.mockReturnValue([device('en-US', 'US')]));

describe('resolveDeviceLocale', () => {
  it('maps a Brazilian device (languageCode "pt") to pt-BR', () => {
    expect(resolveDeviceLocale([device('pt-BR', 'BR')])).toBe('pt-BR');
  });

  it('maps any Portuguese variant to pt-BR rather than English', () => {
    expect(resolveDeviceLocale([device('pt-PT', 'PT')])).toBe('pt-BR');
  });

  it('maps regional Spanish to the base es locale', () => {
    expect(resolveDeviceLocale([device('es-MX', 'MX')])).toBe('es');
    expect(resolveDeviceLocale([device('es-ES', 'ES')])).toBe('es');
  });

  it('takes the first supported language in the device preference list', () => {
    expect(resolveDeviceLocale([device('nl-NL', 'NL'), device('de-DE', 'DE')])).toBe('de');
  });

  it('falls back to English when nothing matches', () => {
    expect(resolveDeviceLocale([device('nl-NL', 'NL')])).toBe('en');
    expect(resolveDeviceLocale([])).toBe('en');
  });
});

describe('toI18nLanguage', () => {
  it('loads the Spain override resource for Spanish on a Spanish-region device', () => {
    expect(toI18nLanguage('es', 'ES')).toBe('es-ES');
  });

  it('keeps neutral Spanish for Latin American regions', () => {
    expect(toI18nLanguage('es', 'MX')).toBe('es');
    expect(toI18nLanguage('es', 'CO')).toBe('es');
    expect(toI18nLanguage('es', null)).toBe('es');
  });

  it('leaves locales without regional variants unchanged', () => {
    expect(toI18nLanguage('fr', 'ES')).toBe('fr');
  });
});

describe('effectiveLocale', () => {
  it('follows the device for the system preference', () => {
    mockDeviceLocales.mockReturnValue([device('pt-BR', 'BR')]);
    expect(effectiveLocale(LOCALE_PREFERENCE.SYSTEM)).toBe('pt-BR');
  });

  it('keeps an explicit choice whatever the device says', () => {
    mockDeviceLocales.mockReturnValue([device('pt-BR', 'BR')]);
    expect(effectiveLocale('fr')).toBe('fr');
  });
});

describe('applyLocalePreference', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('switches a Spain device to es-ES with es and en as fallbacks', () => {
    mockDeviceLocales.mockReturnValue([device('es-ES', 'ES')]);
    applyLocalePreference(LOCALE_PREFERENCE.SYSTEM);
    expect(i18n.language).toBe('es-ES');
    // A key Spain does not override resolves from the neutral es resource.
    const overridden = new Set(Object.keys((esES as { common?: object }).common ?? {}));
    const key = overridden.has('save') ? 'common.cancel' : 'common.save';
    expect(i18n.t(key)).toBe(i18n.getFixedT('es')(key));
  });
});

describe('native supportedLocales', () => {
  it('declares exactly the app locales to iOS and Android', () => {
    expect([...APP_LOCALES].sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });
});
