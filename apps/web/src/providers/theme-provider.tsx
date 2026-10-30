'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/theme-init-script';

/** 'system' follows prefers-color-scheme; a stored 'light' | 'dark' wins. */
export const Theme = { Light: 'light', Dark: 'dark', System: 'system' } as const;
export type Theme = (typeof Theme)[keyof typeof Theme];
export type ResolvedTheme = typeof Theme.Light | typeof Theme.Dark;

/** Browser-chrome colour per scheme: the graphite and paper grounds (palette.plateG0 / plateLightG0). */
const THEME_COLOR: Record<ResolvedTheme, string> = { dark: '#111214', light: '#f3f2ef' };

const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === Theme.Light || stored === Theme.Dark ? stored : Theme.System;
  } catch {
    return Theme.System;
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? Theme.Dark : Theme.Light;
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === Theme.Dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The pre-paint script already set the class; start from 'dark' on the
  // server and reconcile with storage + the OS preference after hydration.
  const [theme, setThemeState] = useState<Theme>(Theme.System);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(Theme.Dark);

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    const resolved = stored === Theme.System ? systemTheme() : stored;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Follow the OS while no explicit choice is stored.
  useEffect(() => {
    if (theme !== Theme.System) return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const resolved = systemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      if (next === Theme.System) localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page only.
    }
    const resolved = next === Theme.System ? systemTheme() : next;
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
