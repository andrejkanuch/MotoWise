'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// TODO: Re-enable light/system theme support once light mode styles are properly configured
type Theme = 'dark';
type ResolvedTheme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState<Theme>('dark');
  const resolvedTheme: ResolvedTheme = 'dark';

  // Ensure dark class is always applied
  useEffect(() => {
    document.documentElement.classList.add('dark');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#0a0a0a');
  }, []);

  const setTheme = useCallback((_next: Theme) => {
    // No-op: only dark mode is supported currently
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
