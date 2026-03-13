import { palette } from '@motovault/design-system';

export const ONBOARDING_COLORS = {
  background: palette.surfaceDark,
  textPrimary: palette.white,
  textSecondary: palette.neutral400,
  textMuted: 'rgba(255,255,255,0.45)',
  textDimmed: 'rgba(255,255,255,0.3)',
  cardBg: 'rgba(255,255,255,0.06)',
  cardBgSelected: 'rgba(255,255,255,0.12)',
  cardBorder: 'rgba(255,255,255,0.10)',
  cardBorderDefault: 'rgba(255,255,255,0.08)',
  accent: palette.indigo400,
  accentBg: palette.indigoBg,
  success: palette.success500,
  warning: palette.warning500,
  error: palette.danger500,
} as const;
