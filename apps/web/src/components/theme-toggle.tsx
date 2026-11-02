'use client';

import { Moon, Sun } from 'lucide-react';
import { Theme, useTheme } from '@/providers/theme-provider';

/**
 * One control, two schemes: flips between light and dark and stores the
 * choice. Both icons are rendered and `html.dark` (set by the pre-paint
 * script) selects the visible one, so the icon is right before React runs
 * and the swap is a quarter-turn cross-fade (design-system.css). Pass
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
      <Sun size={18} aria-hidden="true" className="mv-toggle-sun" />
      <Moon size={18} aria-hidden="true" className="mv-toggle-moon" />
    </button>
  );
}
