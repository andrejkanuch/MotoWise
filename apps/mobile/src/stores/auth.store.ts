import type { Currency, MeasurementSystem } from '@motovault/types';
import type { Session } from '@supabase/supabase-js';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { setAppLocales } from '../../modules/app-locale';
import { applyLocalePreference } from '../i18n';
import {
  appLocalesFor,
  DEFAULT_LOCALE,
  LANGUAGE_CONTROL,
  LOCALE_PREFERENCE,
  type LocalePreference,
  languageControl,
  readOsAppLocales,
  reconcileWithAppLocales,
} from '../i18n/locale';
import { AUTH_HYDRATION, type AuthHydration } from '../lib/auth-hydration';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';
import { MAP_ORIENTATIONS, type MapOrientation } from '../utils/map-orientation';

export const COLOR_SCHEME = { SYSTEM: 'system', LIGHT: 'light', DARK: 'dark' } as const;
export type ColorScheme = (typeof COLOR_SCHEME)[keyof typeof COLOR_SCHEME];

/** Auto-detect measurement system from device locale */
function detectMeasurementSystem(): MeasurementSystem {
  try {
    const locale = getLocales()[0];
    // measurementSystem is 'metric' or 'us' on iOS/Android
    return locale?.measurementSystem === 'metric' ? 'metric' : 'imperial';
  } catch {
    return 'metric';
  }
}

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  /**
   * Three-state hydration: PENDING / RESOLVED / UNRESOLVED. `isLoading` is kept
   * as the equivalent of `hydration === PENDING` so existing callers are
   * unaffected; only the gate needs to tell RESOLVED-null ("signed out") apart
   * from UNRESOLVED-null ("we do not know"). See lib/auth-hydration.
   */
  hydration: AuthHydration;
  /** `system` follows the device language (and per-app language in OS settings). */
  locale: LocalePreference;
  /** Persisted marker: this install's `locale` already knows about `system`. See mergeAuthPreferences. */
  localeSchema: number;
  colorScheme: ColorScheme;
  onboardingCompleted: boolean;
  /**
   * Persisted: true once ANY session has existed on this install. Drives the
   * anonymous-onboarding gate — fresh installs onboard before auth (A/B 2026),
   * while returning users who sign out land on the (auth) login screen.
   */
  hasAuthenticatedBefore: boolean;
  measurementSystem: MeasurementSystem;
  currency: Currency;
  /** Ride-map orientation: `north` (fixed) or `heading` (course-up). */
  mapOrientation: MapOrientation;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  /** The hydration timer fired: hydration is UNRESOLVED, NOT "signed out". */
  markHydrationUnresolved: () => void;
  /** The rider pressed "Sign in instead" on the restoring screen. */
  forceHydrationResolved: () => void;
  setLocale: (locale: LocalePreference) => void;
  /** Android 13+: take the OS per-app language (App info → Language) as the preference. */
  syncLocaleWithOs: () => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setMeasurementSystem: (system: MeasurementSystem) => void;
  setCurrency: (currency: Currency) => void;
  setMapOrientation: (orientation: MapOrientation) => void;
}

/** Exactly the keys persisted to MMKV — excludes `session`/`isLoading`/`onboardingCompleted`. */
export function partializeAuthState(state: AuthState) {
  return {
    locale: state.locale,
    localeSchema: state.localeSchema,
    colorScheme: state.colorScheme,
    measurementSystem: state.measurementSystem,
    currency: state.currency,
    mapOrientation: state.mapOrientation,
    hasAuthenticatedBefore: state.hasAuthenticatedBefore,
  };
}

/**
 * `locale` gained `system` (follow the device). Before that the store
 * defaulted to `en` without the rider choosing it, so a saved `en` with no
 * `localeSchema` means "never picked" and becomes `system`. A rider who did pick
 * English on a non-English phone now follows the device and can pick it again.
 *
 * Deliberately NOT a persist `version` bump: zustand discards the whole stored
 * blob when the stored version is newer than the running code's and there is no
 * `migrate`, so any OTA built from older code (the hotfix-from-release-commit
 * flow in docs/runbooks/mobile-ota.md) would wipe every rider's preferences and
 * `hasAuthenticatedBefore`. Older code reads `system` as an unknown language and
 * falls back to English, which is what it showed before.
 */
export const LOCALE_SCHEMA = {
  /** `locale` knows about `system`. */
  SYSTEM_AWARE: 1,
  /** Android 13+: any earlier in-app choice has been carried into the OS setting. */
  OS_SYNCED: 2,
} as const;

type PersistedAuthPreferences = ReturnType<typeof partializeAuthState>;

export function mergeAuthPreferences<T extends object>(persisted: unknown, current: T): T {
  const saved = (persisted ?? {}) as Partial<PersistedAuthPreferences>;
  const neverChose =
    saved.localeSchema === undefined &&
    (saved.locale === undefined || saved.locale === DEFAULT_LOCALE);
  return {
    ...current,
    ...saved,
    ...(neverChose && { locale: LOCALE_PREFERENCE.SYSTEM }),
    localeSchema: saved.localeSchema ?? LOCALE_SCHEMA.SYSTEM_AWARE,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: true,
      hydration: AUTH_HYDRATION.PENDING,
      locale: LOCALE_PREFERENCE.SYSTEM,
      localeSchema: LOCALE_SCHEMA.SYSTEM_AWARE,
      colorScheme: 'system',
      onboardingCompleted: false,
      hasAuthenticatedBefore: false,
      measurementSystem: detectMeasurementSystem(),
      currency: 'USD',
      mapOrientation: MAP_ORIENTATIONS.NORTH,
      setSession: (session) =>
        set({
          session,
          // ANY answer from the auth listener is authoritative, including null.
          // supabase-js guarantees INITIAL_SESSION fires exactly once per
          // subscriber after initializePromise resolves — with null when there
          // is no stored session, and with null from the catch path on a
          // hydration error — so this is reached on every launch and is what
          // un-sticks UNRESOLVED.
          hydration: AUTH_HYDRATION.RESOLVED,
          isLoading: false,
          ...(session === null ? { onboardingCompleted: false } : { hasAuthenticatedBefore: true }),
        }),
      setLoading: (isLoading) => set({ isLoading }),
      markHydrationUnresolved: () =>
        set((state) =>
          // A late timer must never un-resolve a settled session.
          state.hydration === AUTH_HYDRATION.PENDING
            ? { hydration: AUTH_HYDRATION.UNRESOLVED, isLoading: false }
            : state,
        ),
      forceHydrationResolved: () => set({ hydration: AUTH_HYDRATION.RESOLVED, isLoading: false }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setLocale: (locale) => {
        if (languageControl() === LANGUAGE_CONTROL.OS_API) setAppLocales(appLocalesFor(locale));
        applyLocalePreference(locale);
        set({ locale });
      },
      syncLocaleWithOs: () => {
        const osLocales = readOsAppLocales();
        if (!osLocales) return;
        const { locale, localeSchema } = get();
        const { preference, writeOs } = reconcileWithAppLocales(
          locale,
          osLocales,
          localeSchema < LOCALE_SCHEMA.OS_SYNCED,
        );
        if (writeOs) setAppLocales(writeOs);
        set({ locale: preference, localeSchema: LOCALE_SCHEMA.OS_SYNCED });
      },
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setMeasurementSystem: (measurementSystem) => set({ measurementSystem }),
      setCurrency: (currency) => set({ currency }),
      setMapOrientation: (mapOrientation) => set({ mapOrientation }),
    }),
    {
      name: 'auth-preferences',
      storage: createJSONStorage(() => createZustandMMKVStorage('auth-preferences')),
      partialize: partializeAuthState,
      merge: mergeAuthPreferences,
    },
  ),
);
