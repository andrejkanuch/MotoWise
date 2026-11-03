import { SUPPORTED_LOCALES, type SupportedLocale } from '@motovault/types';

/** The subset of expo-localization's Locale this needs. */
export interface DeviceLocale {
  languageTag?: string | null;
  languageCode?: string | null;
}

const FALLBACK_LOCALE: SupportedLocale = 'en';

/**
 * The app language for the device's preferred languages, in preference order. A shipped regional
 * locale (pt-BR) matches its exact tag or, failing that, its bare language code, so a phone set to
 * Portuguese ("pt" / "pt-BR" / "pt-PT") gets pt-BR instead of falling back to English, which is
 * what happened when only the bare code was compared against the list.
 */
export function resolveSupportedLocale(locales: readonly DeviceLocale[]): SupportedLocale {
  const supported = SUPPORTED_LOCALES as readonly string[];
  const byLower = new Map(supported.map((l) => [l.toLowerCase(), l as SupportedLocale]));
  const byLanguage = new Map<string, SupportedLocale>();
  for (const l of SUPPORTED_LOCALES) {
    const language = l.split('-')[0].toLowerCase();
    if (!byLanguage.has(language)) byLanguage.set(language, l);
  }
  for (const locale of locales) {
    const tag = locale.languageTag?.toLowerCase();
    if (tag && byLower.has(tag)) return byLower.get(tag) as SupportedLocale;
    const language = (locale.languageCode ?? tag?.split('-')[0])?.toLowerCase();
    if (language && byLanguage.has(language)) return byLanguage.get(language) as SupportedLocale;
  }
  return FALLBACK_LOCALE;
}
