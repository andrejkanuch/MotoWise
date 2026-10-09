/**
 * App theme — Race Plate world (graphite ramp, bone ink, copper action, plate states).
 * Provides semantic color tokens for dark/light mode and shared UI constants.
 *
 * Usage:
 *   const { t, isDark } = useEditorialTheme();
 *   <View style={{ backgroundColor: t.bg, borderColor: t.line }} />
 */

import { palette } from '@motovault/design-system';
import { useColorScheme } from 'nativewind';
import { createContext, useContext } from 'react';

// Race Plate world (DESIGN.md). Token names are kept from the editorial era so
// every screen moves to the new ramp at once; `warm` is copper (action) and
// `warm2` its text-weight variant — never an accent for display type.
const dark = {
  bg: palette.plateG0,
  bg2: palette.plateG0,
  surface: palette.plateG1,
  surface2: palette.plateG2,
  surface3: palette.plateG3,
  ink: palette.plateInk,
  ink2: palette.plateInk2,
  ink3: palette.plateInk3,
  ink4: palette.plateInk4,
  line: palette.plateLineDark,
  line2: palette.plateLine2Dark,
  warm: palette.plateCopper,
  warm2: palette.plateCopperText,
  success: palette.plateGo,
  danger: palette.plateRed,
  info: palette.plateInfo,
  purple: palette.editorialPurple,
  /** Plate-state triad — the signature move. */
  plateReady: palette.plateBone,
  plateDue: palette.plateSignal,
  plateOverdue: palette.plateRed,
  onPlate: palette.plateOnPlate,
} as const;

const light: EditorialTokens = {
  bg: palette.plateLightG0,
  bg2: palette.plateLightG2,
  surface: palette.plateLightG1,
  surface2: palette.plateLightG2,
  surface3: palette.plateLightG3,
  ink: palette.plateLightInk,
  ink2: palette.plateLightInk2,
  ink3: palette.plateLightInk3,
  ink4: palette.plateLightInk4,
  line: palette.plateLineLight,
  line2: palette.plateLine2Light,
  warm: palette.plateLightCopper,
  warm2: palette.plateLightCopper,
  success: palette.plateLightGo,
  danger: palette.plateLightRed,
  info: palette.plateLightInfo,
  purple: palette.editorialPurple,
  plateReady: palette.plateBone,
  plateDue: palette.plateSignal,
  plateOverdue: palette.plateRed,
  onPlate: palette.plateOnPlate,
} as const;

export type EditorialTokens = { [K in keyof typeof dark]: string };

export const editorialThemes = { dark, light } as const;

export const EDITORIAL_SCHEME = { DARK: 'dark', LIGHT: 'light' } as const;
export type EditorialScheme = (typeof EDITORIAL_SCHEME)[keyof typeof EDITORIAL_SCHEME];

/**
 * Pins the editorial scheme for a subtree, whatever the system scheme is. The
 * bike hub is dark in both schemes, so the legacy sections it wraps render
 * under `EDITORIAL_SCHEME.DARK` to read as one surface with it.
 */
const EditorialSchemeContext = createContext<EditorialScheme | null>(null);
export const EditorialSchemeProvider = EditorialSchemeContext.Provider;

export function useEditorialTheme() {
  const { colorScheme } = useColorScheme();
  const pinned = useContext(EditorialSchemeContext);
  const isDark = (pinned ?? colorScheme) === EDITORIAL_SCHEME.DARK;
  return { t: isDark ? dark : light, isDark } as const;
}

// Memoise hex→rgba conversions: tint() is called per-row in lists and the
// keyspace (palette color × alpha) is tiny and bounded. React Compiler can't
// cache a pure module-level function, so this stays a manual cache.
const tintCache = new Map<string, string>();

/** Tint a color with transparency — e.g. tint(t.warm, 0.18) */
export function tint(color: string, alpha: number): string {
  // rgba inputs are returned as-is (cheap, no parse needed).
  if (color.startsWith('rgba')) return color;

  const key = `${color}|${alpha}`;
  const cached = tintCache.get(key);
  if (cached !== undefined) return cached;

  const hex = color.replace('#', '');
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  const result = `rgba(${r},${g},${b},${alpha})`;
  tintCache.set(key, result);
  return result;
}
