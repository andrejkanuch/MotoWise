import { palette } from '@motovault/design-system';
import {
  type EditorialTokens,
  editorialThemes,
  tint,
  useEditorialTheme,
} from '../../theme/editorial';

/**
 * Onboarding colors — Race Plate world, both schemes (DESIGN.md).
 *
 * A semantic view over the `useEditorialTheme` tokens so onboarding and auth
 * follow the system scheme like every other surface. Key names are kept from
 * the editorial era; `warm`/`accent` are copper (action and selection only),
 * `warm2` its text-weight variant for links, `textOnAccent` the ink on copper.
 */
function onboardingColorsFor(t: EditorialTokens) {
  return {
    background: t.bg,
    textPrimary: t.ink,
    textSecondary: t.ink2,
    textMuted: t.ink3,
    textDimmed: t.ink4,
    cardBg: t.surface,
    cardBgSelected: t.surface2,
    cardBorder: t.line,
    accent: t.warm,
    accentBg: tint(t.warm, 0.14),
    success: t.success,
    warning: t.dueInk,
    error: t.danger,
    warm: t.warm,
    warm2: t.warm2,
    surface: t.surface,
    surface2: t.surface2,
    surface3: t.surface3,
    line: t.line,
    ink3: t.ink3,

    // ── Borders ──
    borderMuted: t.surface3,

    // ── Text helpers ──
    /** Ink on copper fills */
    textOnAccent: t.onWarm,
    textSoft: t.ink3,
    textBody: t.ink2,

    // ── Semantic hues ──
    blue: t.info,
    amber: t.dueInk,
    green: t.success,

    // ── Semantic action colors ──
    acceptGreen: t.success,
    rejectRed: t.overdueInk,

    // ── Opacity helpers ──
    borderFaint: t.line2,
    dotInactive: t.surface3,
    surfaceOverlayDark: tint(t.bg, 0.6),

    // ── Accept/reject borders ──
    rejectDotFaded: tint(t.overdueInk, 0.7),

    // ── Brand marks (make-initial badges) — same in both schemes ──
    /** Bone ink on a brand-colour badge */
    brandMarkInk: palette.plateInk,
    /** Badge fill for a make without a brand colour */
    brandMarkFallback: palette.plateG3,

    // ── Priority tone backgrounds ──
    rejectBgTint: tint(t.overdueInk, 0.15),
  } as const;
}

export type OnboardingColors = ReturnType<typeof onboardingColorsFor>;

/** Onboarding colors for the current scheme. */
export function useOnboardingColors(): OnboardingColors {
  const { t } = useEditorialTheme();
  return onboardingColorsFor(t);
}

/**
 * Colours for text and scrims laid over a hero photo. A photo is not the theme
 * ground, so these are the dark-scheme tokens in both schemes: a dark veil
 * keeps the image's contrast and light ink stays readable on it.
 */
export const ONBOARDING_HERO_COLORS: OnboardingColors = onboardingColorsFor(editorialThemes.dark);
