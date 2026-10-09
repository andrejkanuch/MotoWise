import {
  CURRENCY_SYMBOLS,
  type Currency,
  MeasurementSystem,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@motovault/types';
import { useColorScheme } from 'nativewind';
import { useTranslation } from 'react-i18next';
import { useUpdatePreference } from '../../hooks/use-profile-data';
import { COLOR_SCHEME, type ColorScheme, useAuthStore } from '../../stores/auth.store';
import { MAP_ORIENTATIONS, type MapOrientation } from '../../utils/map-orientation';
import { APP_PREFERENCE_KEY, type AppPreferenceKey } from './constants';

/** Endonyms — each language is listed in its own name, whatever the UI locale. */
const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  'pt-BR': 'Português (BR)',
  ja: '日本語',
  hi: 'हिन्दी',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
  tr: 'Türkçe',
  pl: 'Polski',
  sk: 'Slovenčina',
};

const THEME_LABEL_KEYS = {
  [COLOR_SCHEME.SYSTEM]: 'profile.themeSystem',
  [COLOR_SCHEME.LIGHT]: 'profile.themeLight',
  [COLOR_SCHEME.DARK]: 'profile.themeDark',
} as const;

const UNIT_LABEL_KEYS = {
  [MeasurementSystem.METRIC]: 'profile.metric',
  [MeasurementSystem.IMPERIAL]: 'profile.imperial',
} as const satisfies Record<MeasurementSystem, string>;

const MAP_LABEL_KEYS = {
  [MAP_ORIENTATIONS.NORTH]: 'profile.mapNorthUp',
  [MAP_ORIENTATIONS.HEADING]: 'profile.mapHeadingUp',
} as const satisfies Record<MapOrientation, string>;

export type PreferenceOption = { value: string; label: string; subtitle?: string };

export type AppPreference = {
  title: string;
  options: PreferenceOption[];
  selected: string;
  /** Label of the selected option, for the settings row's trailing value. */
  selectedLabel: string;
  select: (value: string) => void;
};

/**
 * The five single-choice app settings (language, theme, units, currency, ride
 * map): their options, current value, and how a choice is applied. Units and
 * currency are account-level, so a choice is written to the server too.
 */
export function useAppPreferences(): Record<AppPreferenceKey, AppPreference> {
  const { t } = useTranslation();
  const store = useAuthStore();
  const { setColorScheme } = useColorScheme();
  const updatePreference = useUpdatePreference();

  const build = (
    title: string,
    options: PreferenceOption[],
    selected: string,
    select: (value: string) => void,
  ): AppPreference => ({
    title,
    options,
    selected,
    selectedLabel: options.find((o) => o.value === selected)?.label ?? selected,
    select,
  });

  return {
    [APP_PREFERENCE_KEY.LANGUAGE]: build(
      t('profile.language'),
      SUPPORTED_LOCALES.map((loc) => ({ value: loc, label: LOCALE_DISPLAY_NAMES[loc] })),
      store.locale,
      (value) => store.setLocale(value as SupportedLocale),
    ),
    [APP_PREFERENCE_KEY.THEME]: build(
      t('profile.theme'),
      Object.values(COLOR_SCHEME).map((value) => ({ value, label: t(THEME_LABEL_KEYS[value]) })),
      store.colorScheme,
      (value) => {
        const choice = value as ColorScheme;
        store.setColorScheme(choice);
        setColorScheme(choice === COLOR_SCHEME.SYSTEM ? 'unspecified' : choice);
      },
    ),
    [APP_PREFERENCE_KEY.UNITS]: build(
      t('profile.units'),
      Object.values(MeasurementSystem).map((value) => ({
        value,
        label: t(UNIT_LABEL_KEYS[value]),
      })),
      store.measurementSystem,
      (value) => {
        const system = value as MeasurementSystem;
        store.setMeasurementSystem(system);
        updatePreference.mutate({ measurementSystem: system });
      },
    ),
    [APP_PREFERENCE_KEY.CURRENCY]: build(
      t('profile.currency'),
      Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => ({
        value: code,
        label: code,
        subtitle: symbol,
      })),
      store.currency,
      (value) => {
        store.setCurrency(value as Currency);
        updatePreference.mutate({ currency: value });
      },
    ),
    [APP_PREFERENCE_KEY.RIDE_MAP]: build(
      t('profile.rideMap'),
      Object.values(MAP_ORIENTATIONS).map((value) => ({ value, label: t(MAP_LABEL_KEYS[value]) })),
      store.mapOrientation,
      (value) => store.setMapOrientation(value as MapOrientation),
    ),
  };
}
