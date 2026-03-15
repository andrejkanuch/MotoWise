import { palette } from '@motovault/design-system';
import { useColorScheme } from 'react-native';

const darkColors = {
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
  disabledBg: 'rgba(255,255,255,0.08)',
  switchTrackFalse: 'rgba(255,255,255,0.1)',
  dontKnowBorderSelected: 'rgba(255,255,255,0.3)',
  dontKnowBorder: 'rgba(255,255,255,0.15)',
  progressTrack: 'rgba(255,255,255,0.06)',
  gradientStart: 'rgba(15,23,42,0)',
  gradientEnd: 'rgba(15,23,42,1)',
  submittingBg: 'rgba(129,140,248,0.7)',
} as const;

const lightColors = {
  background: palette.white, // #ffffff
  cardBg: 'rgba(0,0,0,0.03)',
  cardBgSelected: 'rgba(99,102,241,0.08)',
  cardBorder: 'rgba(0,0,0,0.08)',
  cardBorderSelected: palette.indigo500, // #6366F1
  accent: palette.indigo500,
  accentBg: 'rgba(99,102,241,0.10)',
  textPrimary: palette.neutral950, // #0a0a0a
  textSecondary: palette.neutral600, // #525252
  textMuted: palette.neutral400, // #a3a3a3
  disabledBg: 'rgba(0,0,0,0.05)',
  switchTrackFalse: 'rgba(0,0,0,0.1)',
  dontKnowBorderSelected: 'rgba(0,0,0,0.2)',
  dontKnowBorder: 'rgba(0,0,0,0.12)',
  progressTrack: 'rgba(0,0,0,0.06)',
  gradientStart: 'rgba(255,255,255,0)',
  gradientEnd: 'rgba(255,255,255,1)',
  submittingBg: 'rgba(99,102,241,0.5)',
} as const;

export type DiagnosticColors = { [K in keyof typeof darkColors]: string };

export function useDiagnosticColors(): DiagnosticColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}
