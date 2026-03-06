import type { SupportedLocale } from '@motolearn/types';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import i18n from '../i18n';

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  locale: SupportedLocale;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setLocale: (locale: SupportedLocale) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  isLoading: true,
  locale: 'en',
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
  setLocale: (locale) => {
    i18n.changeLanguage(locale);
    set({ locale });
  },
}));
