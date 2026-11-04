import { SUPPORTED_LOCALES, type SupportedLocale } from '@motovault/types';
import { getLocales, type Locale } from 'expo-localization';
import { getAppLocales, isAppLocaleSupported } from '../../modules/app-locale';

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

/**
 * Where the rider changes the app language:
 * - OS_SETTINGS (iOS): Settings → MotoVault → Language. iOS has no public API to
 *   set it, and restarts the app in the new language, so native and library text
 *   (paywall, pickers, permission prompts) match ours.
 * - OS_API (Android 13+): our in-app list, written to the OS per-app language
 *   (LocaleManager), so App info → Language and the in-app list always agree.
 * - IN_APP (Android 12 and older, web): our own stored choice only.
 */
export const LANGUAGE_CONTROL = {
  OS_SETTINGS: 'os_settings',
  OS_API: 'os_api',
  IN_APP: 'in_app',
} as const;
export type LanguageControl = (typeof LANGUAGE_CONTROL)[keyof typeof LANGUAGE_CONTROL];

/** `os` defaults to the build platform; tests pass it, since jest inlines EXPO_OS. */
export function languageControl(os = process.env.EXPO_OS): LanguageControl {
  if (os === 'ios') return LANGUAGE_CONTROL.OS_SETTINGS;
  return isAppLocaleSupported() ? LANGUAGE_CONTROL.OS_API : LANGUAGE_CONTROL.IN_APP;
}

/** The OS per-app language list for a preference: empty follows the system. */
export function appLocalesFor(preference: LocalePreference): string[] {
  return preference === LOCALE_PREFERENCE.SYSTEM ? [] : [preference];
}

/** The preference an OS per-app language list stands for. */
export function preferenceFromAppLocales(tags: readonly string[]): LocalePreference {
  const [first] = tags;
  if (!first) return LOCALE_PREFERENCE.SYSTEM;
  return (
    matchDeviceLocale({ languageTag: first, languageCode: null, regionCode: null }) ??
    LOCALE_PREFERENCE.SYSTEM
  );
}

export type OsLocaleReconciliation = {
  preference: LocalePreference;
  /** Set when the OS per-app language must be written (a one-time carry-over). */
  writeOs?: string[];
};

/**
 * On Android 13+ the OS per-app language is the source of truth, because the
 * rider can change it in App info while the app is closed. The one exception is
 * the first launch on this scheme: a language picked in-app before it existed is
 * carried into the OS setting instead of being reset to the device language.
 */
export function reconcileWithAppLocales(
  stored: LocalePreference,
  osLocales: readonly string[],
  carryOver: boolean,
): OsLocaleReconciliation {
  if (carryOver && osLocales.length === 0 && stored !== LOCALE_PREFERENCE.SYSTEM) {
    return { preference: stored, writeOs: appLocalesFor(stored) };
  }
  return { preference: preferenceFromAppLocales(osLocales) };
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

/** The OS per-app language list where the app manages it (Android 13+); else null. */
export function readOsAppLocales(control = languageControl()): readonly string[] | null {
  return control === LANGUAGE_CONTROL.OS_API ? getAppLocales() : null;
}

function safeGetLocales(): DeviceLocale[] {
  try {
    return getLocales();
  } catch {
    return [];
  }
}
