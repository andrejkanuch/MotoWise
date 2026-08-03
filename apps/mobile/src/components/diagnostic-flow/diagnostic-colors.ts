import { palette, withAlpha } from '@motovault/design-system';
import { useColorScheme } from 'react-native';

const darkColors = {
  background: palette.surfaceDark,
  cardBg: palette.whiteAlpha06,
  cardBgSelected: palette.whiteAlpha12,
  cardBorder: palette.whiteAlpha10,
  cardBorderSelected: palette.indigo400,
  accent: palette.indigo400,
  accentBg: palette.indigoBg,
  textPrimary: palette.whitePure,
  textSecondary: palette.whiteAlpha70,
  textMuted: palette.whiteAlpha60,
  disabledBg: palette.whiteAlpha08,
  switchTrackFalse: palette.whiteAlpha10,
  dontKnowBorderSelected: palette.whiteAlpha30,
  dontKnowBorder: palette.whiteAlpha15,
  progressTrack: palette.whiteAlpha06,
  gradientStart: withAlpha(palette.surfaceDark, 0),
  gradientEnd: palette.surfaceDark,
  submittingBg: withAlpha(palette.indigo400, 0.7),
} as const;

const lightColors = {
  background: palette.white,
  cardBg: palette.blackAlpha03,
  cardBgSelected: withAlpha(palette.indigo500, 0.08),
  cardBorder: palette.blackAlpha08,
  cardBorderSelected: palette.indigo500,
  accent: palette.indigo500,
  accentBg: withAlpha(palette.indigo500, 0.1),
  textPrimary: palette.neutral950,
  textSecondary: palette.neutral600,
  textMuted: palette.neutral400,
  disabledBg: palette.blackAlpha05,
  switchTrackFalse: palette.blackAlpha10,
  dontKnowBorderSelected: palette.blackAlpha20,
  dontKnowBorder: palette.blackAlpha12,
  progressTrack: palette.blackAlpha06,
  gradientStart: withAlpha(palette.whitePure, 0),
  gradientEnd: palette.whitePure,
  submittingBg: withAlpha(palette.indigo500, 0.5),
} as const;

export type DiagnosticColors = { [K in keyof typeof darkColors]: string };

export function useDiagnosticColors(): DiagnosticColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}
