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

  // Neutral — warm-tinted toward signature copper for subconscious cohesion.
  // Every gray carries ~2-4% warmth so surfaces feel lived-in, not clinical.
  white: '#fffbf8',
  black: '#0c0a08',
  neutral50: '#faf8f6',
  neutral100: '#f5f2ef',
  neutral200: '#e6e2de',
  neutral300: '#d4d0cb',
  neutral400: '#a39e98',
  neutral500: '#736e68',
  neutral600: '#52504b',
  neutral700: '#403e3a',
  neutral800: '#262421',
  neutral900: '#181614',
  neutral950: '#0c0b09',

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
  signatureTint: 'rgba(212,98,46,0.12)',
  signatureTintZero: 'rgba(212,98,46,0)',

  // Indigo (onboarding accent)
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigoBg: 'rgba(99,102,241,0.15)',

  // Night mode (amber-red for riding without destroying night vision)
  nightText: '#D44A1A',
  nightBg: '#0D0604',
  nightAccent: '#7A2A0A',
  nightGlow: 'rgba(212,74,26,0.08)',
  nightArcTrack: 'rgba(212,74,26,0.2)',
  nightTickMark: 'rgba(212,74,26,0.3)',

  // Speed gradient (route visualization)
  speedSlow: '#3b82f6',
  speedMedium: '#22c55e',
  speedFast: '#f97316',

  // Elevated surfaces (dark mode depth)
  surfaceElevated: 'rgba(255,255,255,0.06)',
  surfaceSubtle: 'rgba(255,255,255,0.04)',
  surfacePressed: 'rgba(255,255,255,0.05)',
  surfaceHover: 'rgba(255,255,255,0.08)',
  surfaceOverlay: 'rgba(0,0,0,0.6)',
  surfaceProgressFill: 'rgba(0,0,0,0.3)',

  // Accent tints (transparent overlays)
  accentTint: 'rgba(45,158,120,0.12)',
  accentTintLight: 'rgba(45,158,120,0.08)',
  accentTintSubtle: 'rgba(45,158,120,0.1)',
  accentTintZero: 'rgba(45,158,120,0)',
  accentBgLight: 'rgba(45,158,120,0.08)',
  warningBorder: 'rgba(245,158,11,0.2)',

  // Interactive states
  iconMuted: 'rgba(255,255,255,0.5)',
  controlBg: 'rgba(255,255,255,0.1)',
  controlBgActive: 'rgba(255,255,255,0.15)',

  // Profile/settings surfaces
  pressedLight: 'rgba(0,0,0,0.03)',
  pressedDark: 'rgba(255,255,255,0.05)',
  dividerLight: 'rgba(0,0,0,0.06)',
  dividerDark: 'rgba(255,255,255,0.08)',
  dividerSubtleDark: 'rgba(255,255,255,0.06)',
  iconBubbleDark: 'rgba(255,255,255,0.08)',
  dangerTintLight: 'rgba(239,68,68,0.1)',
  dangerTintDark: 'rgba(239,68,68,0.15)',

  // Ride HUD
  hudGlow: 'rgba(45,158,120,0.06)',

  // Surfaces — warm slate, not cold blue-gray
  surfaceDark: '#141210',
  cardDark: '#1E1C19',

  // Tab bar
  tabActive: '#D4622E',
  tabInactive: '#a39e98',
  tabBarLight: '#fffbf8',
  tabBarDark: '#1a1816',

  // ── Editorial redesign tokens (warm magazine aesthetic) ──
  // Dark mode
  editorialDarkBg: '#1a1510',
  editorialDarkBg2: '#110e0a',
  editorialDarkSurface: '#231e18',
  editorialDarkSurface2: '#2d271f',
  editorialDarkSurface3: '#382f26',
  editorialDarkInk: '#faf6f0',
  editorialDarkInk2: '#c4bdb2',
  editorialDarkInk3: '#8e8880',
  editorialDarkInk4: '#5e5850',
  editorialDarkLine: 'rgba(255,255,255,0.08)',
  editorialDarkLine2: 'rgba(255,255,255,0.04)',
  editorialDarkWarm: '#d4884a',
  editorialDarkWarm2: '#e8a86a',

  // Light mode
  editorialLightBg: '#f8f6f2',
  editorialLightBg2: '#f0ede8',
  editorialLightSurface: '#ffffff',
  editorialLightSurface2: '#f5f2ed',
  editorialLightSurface3: '#eae6df',
  editorialLightInk: '#1a1510',
  editorialLightInk2: '#4a453e',
  editorialLightInk3: '#7a746c',
  editorialLightInk4: '#a49e96',
  editorialLightLine: 'rgba(26,21,16,0.09)',
  editorialLightLine2: 'rgba(26,21,16,0.05)',
  editorialLightWarm: '#c47a3a',
  editorialLightWarm2: '#d4944e',

  // Shared semantic
  editorialSuccess: '#4eba6f',
  editorialDanger: '#d44a4a',
  editorialInfo: '#4a8ad4',
  editorialPurple: '#8a5ad4',

  // ── Share card tokens (hex only — view-shot compatible) ──
  shareCopper: '#c8772c',
  shareCopper2: '#d9883a',
  shareCopperSoft: '#e89d5a',
  shareRouteBright: '#e25822',
  shareEmerald: '#2bb673',
  shareDanger: '#d04a3c',
  shareSheetBg: '#14110d',
  shareCardDarkBg: '#0e0c0a',
  shareCream: '#f1ebdd',
  shareCreamText: '#1a1612',
  shareTextLight: '#f2efe9',
  sharePrBg: '#0b0907',
} as const;

export type Palette = typeof palette;

/**
 * Append an alpha channel to a hex color, returning an `rgba()` string. Centralizes the
 * "tinted dynamic color" pattern so components never hand-concatenate a hex-alpha suffix
 * (e.g. `${accent}24`). Accepts #RGB / #RRGGBB; returns the input unchanged if not parseable.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return color;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
