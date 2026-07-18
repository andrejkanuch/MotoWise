import type { Currency, MeasurementSystem, SupportedLocale } from '@motovault/types';
import type { Session } from '@supabase/supabase-js';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18n from '../i18n';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';
import { MAP_ORIENTATIONS, type MapOrientation } from '../utils/map-orientation';

type ColorScheme = 'system' | 'light' | 'dark';

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
  locale: SupportedLocale;
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
  setLocale: (locale: SupportedLocale) => void;
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
    colorScheme: state.colorScheme,
    measurementSystem: state.measurementSystem,
    currency: state.currency,
    mapOrientation: state.mapOrientation,
    hasAuthenticatedBefore: state.hasAuthenticatedBefore,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isLoading: true,
      locale: 'en',
      colorScheme: 'system',
      onboardingCompleted: false,
      hasAuthenticatedBefore: false,
      measurementSystem: detectMeasurementSystem(),
      currency: 'USD',
      mapOrientation: MAP_ORIENTATIONS.NORTH,
      setSession: (session) =>
        set({
          session,
          ...(session === null ? { onboardingCompleted: false } : { hasAuthenticatedBefore: true }),
        }),
      setLoading: (isLoading) => set({ isLoading }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setLocale: (locale) => {
        i18n.changeLanguage(locale);
        set({ locale });
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
    },
  ),
);
