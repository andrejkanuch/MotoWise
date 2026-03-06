import type { SupportedLocale } from '@motolearn/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import i18n from '../i18n';

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  locale: SupportedLocale;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setLocale: (locale: SupportedLocale) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      isLoading: true,
      locale: 'en',
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),
      setLocale: (locale) => {
        i18n.changeLanguage(locale);
        set({ locale });
      },
    }),
    {
      name: 'auth-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ locale: state.locale }),
    },
  ),
);
