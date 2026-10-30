'use client';

import { Moon, Sun } from 'lucide-react';
import { Theme, useTheme } from '@/providers/theme-provider';

/**
 * One control, two schemes: flips between light and dark and stores the
 * choice. Renders as a ghost icon button so it sits in any bar; pass
 * `className` for the host bar's own control styling.
 */
export function ThemeToggle({
  className,
  labels,
}: {
  className?: string;
  /** Accessible names; the host passes translated strings. */
  labels: { toLight: string; toDark: string };
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === Theme.Dark;
  const label = isDark ? labels.toLight : labels.toDark;
  return (
    <button
      type="button"
      className={className}
      onClick={() => setTheme(isDark ? Theme.Light : Theme.Dark)}
      aria-label={label}
      title={label}
      data-theme-toggle
    >
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
}
