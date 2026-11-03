import { getLocales } from 'expo-localization';
// The shared i18next singleton (initialised in src/i18n). Importing that module
// here would load every translation into anything that formats money.
import i18n from 'i18next';

/** Used when no app language is known (tests, very early startup). */
export const FALLBACK_NUMBER_LOCALE = 'en-US';

const REGION_CODE = /^[A-Z]{2}$/;

/**
 * The BCP 47 tag numbers and money are formatted with: the app language, made
 * regional with the device region when the language has none ("es" + "CO" ->
 * "es-CO" gives "$ 185.000"; "de" + "DE" -> "1.234,50 €"). A language that
 * already names a region ("pt-BR") is used as is.
 */
export function numberLocaleFor(language: string | undefined, region: string | undefined): string {
  const lang = language?.trim();
  if (!lang) return FALLBACK_NUMBER_LOCALE;
  if (lang.includes('-')) return lang;
  const regionCode = region?.trim().toUpperCase();
  return regionCode && REGION_CODE.test(regionCode) ? `${lang}-${regionCode}` : lang;
}

/** The number locale for the current app language and device region. */
export function getNumberLocale(): string {
  return numberLocaleFor(i18n.language, getLocales()[0]?.regionCode ?? undefined);
}
