import type { Currency, MeasurementSystem, SupportedLocale } from '@motovault/types';
import type { Session } from '@supabase/supabase-js';
import { getLocales } from 'expo-localization';
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const mmkv = createMMKV({ id: 'auth-preferences' });

const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};
import i18n from '../i18n';

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
  measurementSystem: MeasurementSystem;
  currency: Currency;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setLocale: (locale: SupportedLocale) => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setMeasurementSystem: (system: MeasurementSystem) => void;
  setCurrency: (currency: Currency) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isLoading: true,
      locale: 'en',
      colorScheme: 'system',
      onboardingCompleted: false,
      measurementSystem: detectMeasurementSystem(),
      currency: 'USD',
      setSession: (session) =>
        set({ session, ...(session === null ? { onboardingCompleted: false } : {}) }),
      setLoading: (isLoading) => set({ isLoading }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setLocale: (locale) => {
        i18n.changeLanguage(locale);
        set({ locale });
      },
      setColorScheme: (colorScheme) => set({ colorScheme }),
      setMeasurementSystem: (measurementSystem) => set({ measurementSystem }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'auth-preferences',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        locale: state.locale,
        colorScheme: state.colorScheme,
        measurementSystem: state.measurementSystem,
        currency: state.currency,
      }),
    },
  ),
);
