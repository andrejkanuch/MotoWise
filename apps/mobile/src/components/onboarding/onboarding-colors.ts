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
  warning: palette.warning500,
  error: palette.editorialDanger,
  warm: palette.editorialDarkWarm,
  warm2: palette.editorialDarkWarm2,
  surface: palette.editorialDarkSurface,
  surface2: palette.editorialDarkSurface2,
  surface3: palette.editorialDarkSurface3,
  line: palette.editorialDarkLine,
  ink3: palette.editorialDarkInk3,

  // ── Surface / input backgrounds ──
  /** Dark warm surface for inputs, pills, chips (#1a1812 equivalent) */
  surfaceInput: palette.tabBarDark,
  /** Slightly darker card surface (#1f1a14 / #16130f equivalent) */
  surfaceCard: palette.cardDark,

  // ── Borders ──
  /** Subtle border for inputs and cards (#2a2520 equivalent) */
  borderSubtle: palette.neutral800,
  /** Muted dashed/lighter border (#3a3328 equivalent) */
  borderMuted: palette.editorialDarkSurface3,

  // ── Text helpers ──
  /** White text for headings on dark backgrounds */
  textWhite: palette.white,
  /** Dark text on warm accent buttons (#1a0f08 equivalent) */
  textOnAccent: palette.black,
  /** Label text — uppercase section headers (rgba(255,255,255,0.42)) */
  textLabel: 'rgba(255,255,255,0.42)',
  /** Slightly brighter than textLabel (rgba(255,255,255,0.5)) */
  textSoft: 'rgba(255,255,255,0.5)',
  /** Subtitle / descriptive text (rgba(255,255,255,0.55)) */
  textSubtitle: 'rgba(255,255,255,0.55)',
  /** Secondary body text (rgba(255,255,255,0.78)) */
  textBody: 'rgba(255,255,255,0.78)',
  /** Bright white with slight transparency (rgba(255,255,255,0.82)) */
  textBright: 'rgba(255,255,255,0.82)',
  /** High-contrast secondary text (rgba(255,255,255,0.85)) */
  textHighContrast: 'rgba(255,255,255,0.85)',
  /** Very dim text for de-emphasized elements (rgba(255,255,255,0.25)) */
  textFaintest: 'rgba(255,255,255,0.25)',
  /** Faint text, slightly more visible (rgba(255,255,255,0.32)) */
  textFaint: 'rgba(255,255,255,0.32)',
  /** Barely visible text (rgba(255,255,255,0.35)) */
  textFaded: 'rgba(255,255,255,0.35)',
  /** Muted search/icon color (rgba(255,255,255,0.4)) */
  textMutedIcon: 'rgba(255,255,255,0.4)',
  /** Skip link underline (rgba(255,255,255,0.2)) */
  underlineSubtle: 'rgba(255,255,255,0.2)',
  /** Faintest underline (rgba(255,255,255,0.15) / 0.16) */
  underlineFaint: 'rgba(255,255,255,0.15)',

  // ── Experience-level accent colors ──
  /** Beginner level — sage olive (#A3B18A) */
  accentBeginner: '#A3B18A',
  /** Intermediate level — warm amber (maps to editorialDarkWarm) */
  accentIntermediate: palette.editorialDarkWarm,
  /** Advanced level — dusty copper (#C4634A) */
  accentAdvanced: '#C4634A',

  // ── Semantic action colors ──
  /** Accept / add green (matches editorialSuccess) */
  acceptGreen: palette.editorialSuccess,
  /** Reject / skip red (#C4634A) */
  rejectRed: '#C4634A',
  /** Blue accent for low-priority / info (#6B8BB2) */
  accentBlue: '#6B8BB2',

  // ── Opacity helpers ──
  /** Card unselected background (rgba(22,19,15,0.7)) */
  surfaceCardTranslucent: 'rgba(22,19,15,0.7)',
  /** Swipe card inactive border (rgba(255,255,255,0.1)) */
  borderFaint: 'rgba(255,255,255,0.1)',
  /** Progress dot inactive (rgba(255,255,255,0.12)) */
  dotInactive: 'rgba(255,255,255,0.12)',
  /** Button overlay surface (rgba(0,0,0,0.35)) */
  surfaceOverlayButton: 'rgba(0,0,0,0.35)',
  /** Stamp/overlay dark background (rgba(0,0,0,0.4)) */
  surfaceOverlayDark: 'rgba(0,0,0,0.4)',
  /** Registered stamp background (rgba(0,0,0,0.28)) */
  surfaceOverlayMedium: 'rgba(0,0,0,0.28)',
  /** Dashed stamp border (rgba(255,255,255,0.1)) */
  borderDashed: 'rgba(255,255,255,0.1)',
  /** Icon border color (rgba(255,255,255,0.14)) */
  borderIcon: 'rgba(255,255,255,0.14)',
  /** Unselected card border (rgba(255,255,255,0.08)) */
  borderDefault: 'rgba(255,255,255,0.08)',

  // ── Accept/reject borders (with opacity) ──
  /** Accept button border (rgba(78,186,111,0.5)) */
  acceptBorder: 'rgba(78,186,111,0.5)',
  /** Reject button border (rgba(196,99,74,0.5)) */
  rejectBorder: 'rgba(196,99,74,0.5)',
  /** Reject dot with opacity (rgba(196,99,74,0.7)) */
  rejectDotFaded: 'rgba(196,99,74,0.7)',
  /** Dismiss button surface (#211d18) */
  surfaceDismiss: '#211d18',
  /** Dismiss icon (rgba(255,255,255,0.7)) */
  iconDismiss: 'rgba(255,255,255,0.7)',

  // ── Priority tone backgrounds ──
  /** Critical/high priority tinted bg (rejectRed at 15%) */
  rejectBgTint: 'rgba(196, 99, 74, 0.15)',
  /** Low priority / info tinted bg (accentBlue at 15%) */
  blueBgTint: 'rgba(107, 139, 178, 0.15)',
} as const;
