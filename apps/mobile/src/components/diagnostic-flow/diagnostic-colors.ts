import { palette } from '@motovault/design-system';

export const DIAGNOSTIC_COLORS = {
  background: palette.surfaceDark, // #0F172A
  cardBg: 'rgba(255,255,255,0.06)',
  cardBgSelected: 'rgba(255,255,255,0.12)',
  cardBorder: 'rgba(255,255,255,0.10)',
  cardBorderSelected: palette.indigo400, // #818CF8
  accent: palette.indigo400,
  accentBg: palette.indigoBg, // rgba(99,102,241,0.15)
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.45)',
} as const;
