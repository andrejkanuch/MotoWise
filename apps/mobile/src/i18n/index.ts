import type { SupportedLocale } from '@motovault/types';
import { SUPPORTED_LOCALES } from '@motovault/types';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';

const deviceLang = getLocales()[0]?.languageCode ?? 'en';
const resolvedLang: SupportedLocale = (SUPPORTED_LOCALES as readonly string[]).includes(deviceLang)
  ? (deviceLang as SupportedLocale)
  : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
    },
    lng: resolvedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  .catch(console.error);

export default i18n;
