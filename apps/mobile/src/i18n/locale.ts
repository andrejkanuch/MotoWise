import { SUPPORTED_LOCALES, type SupportedLocale } from '@motovault/types';
import { getLocales, type Locale } from 'expo-localization';

/** The language preference a rider stores: a fixed app locale, or "follow the device". */
export const LOCALE_PREFERENCE = { SYSTEM: 'system' } as const;
export type LocalePreference = SupportedLocale | typeof LOCALE_PREFERENCE.SYSTEM;

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Regional i18next resources layered over a base locale. Each holds only the
 * strings that differ in that region; i18next falls back `es-ES` → `es` → `en`.
 * The API and stored preference keep the base locale (`es`).
 */
const REGIONAL_VARIANTS: Partial<Record<SupportedLocale, Record<string, string>>> = {
  es: { ES: 'es-ES' },
};

type DeviceLocale = Pick<Locale, 'languageTag' | 'languageCode' | 'regionCode'>;

const isSupported = (tag: string): tag is SupportedLocale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(tag);

/**
 * ISO 639 codes Android's `Locale.getLanguage()` still reports in their
 * withdrawn form (Indonesian is `in`, not `id`), mapped to the current code.
 */
const LEGACY_LANGUAGE_CODES: Record<string, string> = { in: 'id', iw: 'he', ji: 'yi' };

const baseLanguage = (tag: string) => {
  const language = tag.split(/[-_]/)[0]?.toLowerCase() ?? '';
  return LEGACY_LANGUAGE_CODES[language] ?? language;
};

/** The supported locale for one device locale: exact tag first (`pt-BR`), then language (`pt` → `pt-BR`). */
function matchDeviceLocale(device: DeviceLocale): SupportedLocale | null {
  if (isSupported(device.languageTag)) return device.languageTag;
  // The tag first: it is canonical BCP-47 (`id-ID`), while `languageCode` can be legacy (`in`).
  const language = baseLanguage(device.languageTag) || baseLanguage(device.languageCode ?? '');
  return SUPPORTED_LOCALES.find((locale) => baseLanguage(locale) === language) ?? null;
}

/** First supported locale in the device's preferred-language list, else English. */
export function resolveDeviceLocale(
  devices: readonly DeviceLocale[] = safeGetLocales(),
): SupportedLocale {
  for (const device of devices) {
    const match = matchDeviceLocale(device);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}

/** The app locale a preference stands for right now. */
export function effectiveLocale(preference: LocalePreference): SupportedLocale {
  return preference === LOCALE_PREFERENCE.SYSTEM ? resolveDeviceLocale() : preference;
}

/** The i18next language to load: the locale's regional variant for the device region, if any. */
export function toI18nLanguage(
  locale: SupportedLocale,
  regionCode: string | null | undefined = safeGetLocales()[0]?.regionCode,
): string {
  const variant = regionCode ? REGIONAL_VARIANTS[locale]?.[regionCode.toUpperCase()] : undefined;
  return variant ?? locale;
}

function safeGetLocales(): DeviceLocale[] {
  try {
    return getLocales();
  } catch {
    return [];
  }
}
