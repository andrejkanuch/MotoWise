import { palette } from '@motovault/design-system';

/**
 * Editorial onboarding colors — warm magazine aesthetic.
 * Dark and light mode variants using the editorial design tokens.
 */
export const ONBOARDING_COLORS = {
  background: palette.editorialDarkBg,
  textPrimary: palette.editorialDarkInk,
  textSecondary: palette.editorialDarkInk2,
  textMuted: palette.editorialDarkInk4,
  textDimmed: 'rgba(255,255,255,0.3)',
  cardBg: palette.editorialDarkSurface,
  cardBgSelected: palette.editorialDarkSurface2,
  cardBorder: palette.editorialDarkLine,
  cardBorderDefault: palette.editorialDarkLine2,
  accent: palette.editorialDarkWarm,
  accentBg: 'rgba(212,136,74,0.14)',
  success: palette.editorialSuccess,
  warning: '#f59e0b',
  error: palette.editorialDanger,
  warm: palette.editorialDarkWarm,
  warm2: palette.editorialDarkWarm2,
  surface: palette.editorialDarkSurface,
  surface2: palette.editorialDarkSurface2,
  line: palette.editorialDarkLine,
  ink3: palette.editorialDarkInk3,
} as const;
