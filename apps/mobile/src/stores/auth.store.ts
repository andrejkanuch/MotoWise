import type { SupportedLocale } from '@motolearn/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18n from '../i18n';

type ColorScheme = 'system' | 'light' | 'dark';

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  locale: SupportedLocale;
  colorScheme: ColorScheme;
  onboardingCompleted: boolean;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setLocale: (locale: SupportedLocale) => void;
  setColorScheme: (colorScheme: ColorScheme) => void;
  setOnboardingCompleted: (completed: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isLoading: true,
      locale: 'en',
      colorScheme: 'system',
      onboardingCompleted: false,
      setSession: (session) => set({ session, ...(session === null ? { onboardingCompleted: false } : {}) }),
      setLoading: (isLoading) => set({ isLoading }),
      setOnboardingCompleted: (onboardingCompleted) => set({ onboardingCompleted }),
      setLocale: (locale) => {
        i18n.changeLanguage(locale);
        set({ locale });
      },
      setColorScheme: (colorScheme) => set({ colorScheme }),
    }),
    {
      name: 'auth-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locale: state.locale, colorScheme: state.colorScheme }),
    },
  ),
);
