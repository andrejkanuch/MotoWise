/**
 * Hex color palette for native usage (icon color props, gradients, inline styles).
 * These map 1:1 to the oklch tokens in colors.ts but work in contexts where
 * oklch is not supported (e.g. lucide icon `color` prop, LinearGradient).
 *
 * Always use NativeWind classes (bg-primary-500, text-neutral-50) when possible.
 * Use this palette only when you need a raw color string for native components.
 */
export const palette = {
  // Brand
  primary50: '#f0f4ff',
  primary100: '#dbe4ff',
  primary200: '#b3c7ff',
  primary300: '#7da3ff',
  primary400: '#4f7bff',
  primary500: '#3366e6',
  primary600: '#2952c4',
  primary700: '#1f40a0',
  primary800: '#17307d',
  primary900: '#0f2059',
  primary950: '#0a1540',

  // Accent (green-teal)
  accent400: '#3cb88c',
  accent500: '#2d9e78',

  // Neutral
  white: '#ffffff',
  black: '#000000',
  neutral50: '#fafafa',
  neutral100: '#f5f5f5',
  neutral200: '#e5e5e5',
  neutral300: '#d4d4d4',
  neutral400: '#a3a3a3',
  neutral500: '#737373',
  neutral600: '#525252',
  neutral700: '#404040',
  neutral800: '#262626',
  neutral900: '#171717',
  neutral950: '#0a0a0a',

  // Semantic
  danger500: '#ef4444',
  success500: '#22c55e',
  warning500: '#f59e0b',

  // Severity backgrounds (light)
  dangerBgLight: '#fee2e2',
  warningBgLight: '#fef3c7',
  successBgLight: '#dcfce7',

  // Severity backgrounds (dark)
  dangerBgDark: '#450a0a',
  warningBgDark: '#451a03',
  successBgDark: '#052e16',

  // Module accent colors
  moduleEngine: '#ef4444',
  moduleSuspension: '#3b82f6',
  moduleElectrical: '#f59e0b',
  moduleMaintenance: '#22c55e',

  // Gradient stops
  gradientCTAStart: '#1b3a6b',
  gradientCTAEnd: '#2563eb',

  // Hero gradient (3-stop for depth)
  gradientHeroStart: '#0f1f3d',
  gradientHeroMid: '#1b3a6b',
  gradientHeroEnd: '#2563eb',

  // Signature (exhaust copper)
  signature400: '#E8723A',
  signature500: '#D4622E',
  signature600: '#B85226',
  signatureBgLight: '#FFF1EB',
  signatureBgDark: '#3B1A0A',

  // Surfaces
  surfaceDark: '#0F172A',
  cardDark: '#1E293B',

  // Tab bar
  tabActive: '#D4622E',
  tabInactive: '#a3a3a3',
  tabBarLight: '#ffffff',
  tabBarDark: '#1c1c1e',
} as const;

export type Palette = typeof palette;
