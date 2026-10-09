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
    cardBorderDefault: t.line,
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

    // ── Surface / input backgrounds ──
    surfaceInput: t.surface2,
    surfaceCard: t.surface,

    // ── Borders ──
    borderSubtle: t.line,
    borderMuted: t.surface3,

    // ── Text helpers ──
    textWhite: t.ink,
    /** Ink on copper fills */
    textOnAccent: t.onWarm,
    textLabel: t.ink3,
    textSoft: t.ink3,
    textSubtitle: t.ink2,
    textBody: t.ink2,
    textBright: t.ink,
    textHighContrast: t.ink,
    textFaintest: t.ink4,
    textFaint: t.ink4,
    textFaded: t.ink4,
    textMutedIcon: t.ink3,
    underlineSubtle: tint(t.ink, 0.2),
    underlineFaint: tint(t.ink, 0.15),

    // ── Experience levels — one neutral ramp, copper marks the selection ──
    accentBeginner: t.ink2,
    accentIntermediate: t.ink2,
    accentAdvanced: t.ink2,

    // ── Semantic hues ──
    blue: t.info,
    teal: t.success,
    amber: t.dueInk,
    green: t.success,

    // ── Semantic action colors ──
    acceptGreen: t.success,
    rejectRed: t.overdueInk,
    accentBlue: t.info,

    // ── Opacity helpers ──
    surfaceCardTranslucent: t.surface,
    borderFaint: t.line2,
    dotInactive: t.surface3,
    surfaceOverlayButton: tint(t.bg, 0.5),
    surfaceOverlayDark: tint(t.bg, 0.6),
    surfaceOverlayMedium: tint(t.bg, 0.4),
    borderDashed: t.line,
    borderIcon: t.line,
    borderDefault: t.line,

    // ── Accept/reject borders ──
    acceptBorder: tint(t.success, 0.5),
    rejectBorder: tint(t.overdueInk, 0.5),
    rejectDotFaded: tint(t.overdueInk, 0.7),
    surfaceDismiss: t.surface2,
    iconDismiss: t.ink2,

    // ── Brand marks (make-initial badges) — same in both schemes ──
    /** Bone ink on a brand-colour badge */
    brandMarkInk: palette.plateInk,
    /** Badge fill for a make without a brand colour */
    brandMarkFallback: palette.plateG3,

    // ── Priority tone backgrounds ──
    rejectBgTint: tint(t.overdueInk, 0.15),
    blueBgTint: tint(t.info, 0.15),
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
