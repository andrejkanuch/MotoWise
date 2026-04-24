/**
 * Editorial design theme — warm magazine aesthetic with Instrument Serif display type.
 * Provides semantic color tokens for dark/light mode and shared UI constants.
 *
 * Usage:
 *   const { t, isDark } = useEditorialTheme();
 *   <View style={{ backgroundColor: t.bg, borderColor: t.line }} />
 */

import { palette } from '@motovault/design-system';
import { useColorScheme } from 'nativewind';

const dark = {
  bg: palette.editorialDarkBg,
  bg2: palette.editorialDarkBg2,
  surface: palette.editorialDarkSurface,
  surface2: palette.editorialDarkSurface2,
  surface3: palette.editorialDarkSurface3,
  ink: palette.editorialDarkInk,
  ink2: palette.editorialDarkInk2,
  ink3: palette.editorialDarkInk3,
  ink4: palette.editorialDarkInk4,
  line: palette.editorialDarkLine,
  line2: palette.editorialDarkLine2,
  warm: palette.editorialDarkWarm,
  warm2: palette.editorialDarkWarm2,
  success: palette.editorialSuccess,
  danger: palette.editorialDanger,
  info: palette.editorialInfo,
  purple: palette.editorialPurple,
} as const;

const light = {
  bg: palette.editorialLightBg,
  bg2: palette.editorialLightBg2,
  surface: palette.editorialLightSurface,
  surface2: palette.editorialLightSurface2,
  surface3: palette.editorialLightSurface3,
  ink: palette.editorialLightInk,
  ink2: palette.editorialLightInk2,
  ink3: palette.editorialLightInk3,
  ink4: palette.editorialLightInk4,
  line: palette.editorialLightLine,
  line2: palette.editorialLightLine2,
  warm: palette.editorialLightWarm,
  warm2: palette.editorialLightWarm2,
  success: palette.editorialSuccess,
  danger: palette.editorialDanger,
  info: palette.editorialInfo,
  purple: palette.editorialPurple,
} as const;

export type EditorialTokens = typeof dark;

export const editorialThemes = { dark, light } as const;

export function useEditorialTheme() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  return { t: isDark ? dark : light, isDark } as const;
}

/** Tint a color with transparency — e.g. tint(t.warm, 0.18) */
export function tint(color: string, alpha: number): string {
  // For rgba colors, extract and adjust
  if (color.startsWith('rgba')) return color;
  // For hex colors, convert to rgba
  const hex = color.replace('#', '');
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
