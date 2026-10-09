import { withAlpha } from '@motovault/design-system';
import { useMemo } from 'react';
import { type EditorialTokens, tint, useEditorialTheme } from '../../theme/editorial';

/**
 * The diagnosis wizard's colour roles, derived from the app theme so the
 * in-app theme override reaches every step. Copper (`accent`) marks action and
 * selection only; options sit on `surface2`.
 */
function buildDiagnosticColors(t: EditorialTokens) {
  return {
    background: t.bg,
    cardBg: t.surface2,
    cardBgSelected: t.surface3,
    cardBorder: t.line,
    cardBorderSelected: t.warm,
    accent: t.warm,
    accentBg: tint(t.warm, 0.14),
    /** Ink on a copper fill (primary buttons, selected checkmarks). */
    onAccent: t.onWarm,
    textPrimary: t.ink,
    textSecondary: t.ink2,
    textMuted: t.ink3,
    disabledBg: t.surface3,
    switchTrackFalse: t.surface3,
    dontKnowBorderSelected: t.ink3,
    dontKnowBorder: t.line,
    progressTrack: t.surface3,
    gradientStart: withAlpha(t.bg, 0),
    gradientEnd: t.bg,
    submittingBg: t.surface3,
    danger: t.danger,
  } as const;
}

export type DiagnosticColors = ReturnType<typeof buildDiagnosticColors>;

export function useDiagnosticColors(): DiagnosticColors {
  const { t } = useEditorialTheme();
  return useMemo(() => buildDiagnosticColors(t), [t]);
}
