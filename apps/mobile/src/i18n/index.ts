import type { SupportedLocale } from '@motovault/types';
import { SUPPORTED_LOCALES } from '@motovault/types';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import pl from './locales/pl.json';
import ptBR from './locales/pt-BR.json';
import sk from './locales/sk.json';
import th from './locales/th.json';
import tr from './locales/tr.json';

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
      fr: { translation: fr },
      it: { translation: it },
      'pt-BR': { translation: ptBR },
      ja: { translation: ja },
      hi: { translation: hi },
      th: { translation: th },
      id: { translation: id },
      tr: { translation: tr },
      pl: { translation: pl },
      sk: { translation: sk },
    },
    lng: resolvedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
  .catch(console.error);

export default i18n;
