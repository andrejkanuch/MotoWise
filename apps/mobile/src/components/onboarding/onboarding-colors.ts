import { palette, withAlpha } from '@motovault/design-system';

/**
 * Editorial onboarding colors — warm magazine aesthetic.
 * Dark and light mode variants using the editorial design tokens.
 */
export const ONBOARDING_COLORS = {
  background: palette.editorialDarkBg,
  textPrimary: palette.editorialDarkInk,
  textSecondary: palette.editorialDarkInk2,
  textMuted: palette.editorialDarkInk4,
  textDimmed: palette.whiteAlpha30,
  cardBg: palette.editorialDarkSurface,
  cardBgSelected: palette.editorialDarkSurface2,
  cardBorder: palette.editorialDarkLine,
  cardBorderDefault: palette.editorialDarkLine2,
  accent: palette.editorialDarkWarm,
  accentBg: withAlpha(palette.editorialDarkWarm, 0.14),
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
  /** Dark warm surface for inputs, pills, chips */
  surfaceInput: palette.tabBarDark,
  /** Slightly darker card surface */
  surfaceCard: palette.cardDark,

  // ── Borders ──
  /** Subtle border for inputs and cards */
  borderSubtle: palette.neutral800,
  /** Muted dashed/lighter border */
  borderMuted: palette.editorialDarkSurface3,

  // ── Text helpers ──
  /** White text for headings on dark backgrounds */
  textWhite: palette.whitePure,
  /** Dark text on warm accent buttons */
  textOnAccent: palette.black,
  /** Label text — uppercase section headers */
  textLabel: palette.whiteAlpha42,
  /** Slightly brighter than textLabel */
  textSoft: palette.whiteAlpha50,
  /** Subtitle / descriptive text */
  textSubtitle: palette.whiteAlpha55,
  /** Secondary body text */
  textBody: palette.whiteAlpha78,
  /** Bright white with slight transparency */
  textBright: palette.whiteAlpha82,
  /** High-contrast secondary text */
  textHighContrast: palette.whiteAlpha85,
  /** Very dim text for de-emphasized elements */
  textFaintest: palette.whiteAlpha25,
  /** Faint text, slightly more visible */
  textFaint: palette.whiteAlpha32,
  /** Barely visible text */
  textFaded: palette.whiteAlpha35,
  /** Muted search/icon color */
  textMutedIcon: palette.whiteAlpha40,
  /** Skip link underline */
  underlineSubtle: palette.whiteAlpha20,
  /** Faintest underline */
  underlineFaint: palette.whiteAlpha15,

  // ── Experience-level accent colors ──
  /** Beginner level — warm amber (design intent; brand is warm-only, no cool sage) */
  accentBeginner: palette.encourageAmber,
  /** Intermediate level — warm amber (maps to editorialDarkWarm) */
  accentIntermediate: palette.editorialDarkWarm,
  /** Advanced level — dusty copper */
  accentAdvanced: palette.experienceAdvanced,

  // ── Semantic accent hues (design spec palette) ──
  /** Trust blue — used for info rows / low-priority signals */
  blue: palette.trustBlue,
  /** Growth teal — used for routes / secondary positive rows */
  teal: palette.growthTeal,
  /** Warm amber — encouragement / weekly-stats row */
  amber: palette.encourageAmber,
  /** Positive green — confirmations / "ready" states */
  green: palette.confirmGreen,

  // ── Semantic action colors ──
  /** Accept / add green (matches editorialSuccess) */
  acceptGreen: palette.editorialSuccess,
  /** Reject / skip red */
  rejectRed: palette.experienceAdvanced,
  /** Blue accent for low-priority / info */
  accentBlue: palette.infoBlue,

  // ── Opacity helpers ──
  /** Card unselected background */
  surfaceCardTranslucent: withAlpha(palette.cardDark, 0.7),
  /** Swipe card inactive border */
  borderFaint: palette.whiteAlpha10,
  /** Progress dot inactive */
  dotInactive: palette.whiteAlpha12,
  /** Button overlay surface */
  surfaceOverlayButton: palette.blackAlpha35,
  /** Stamp/overlay dark background */
  surfaceOverlayDark: palette.blackAlpha40,
  /** Registered stamp background */
  surfaceOverlayMedium: palette.blackAlpha28,
  /** Dashed stamp border */
  borderDashed: palette.whiteAlpha10,
  /** Icon border color */
  borderIcon: palette.whiteAlpha14,
  /** Unselected card border */
  borderDefault: palette.whiteAlpha08,

  // ── Accept/reject borders (with opacity) ──
  /** Accept button border */
  acceptBorder: withAlpha(palette.editorialSuccess, 0.5),
  /** Reject button border */
  rejectBorder: withAlpha(palette.experienceAdvanced, 0.5),
  /** Reject dot with opacity */
  rejectDotFaded: withAlpha(palette.experienceAdvanced, 0.7),
  /** Dismiss button surface */
  surfaceDismiss: palette.surfaceDismiss,
  /** Dismiss icon */
  iconDismiss: palette.whiteAlpha70,

  // ── Priority tone backgrounds ──
  /** Critical/high priority tinted bg (rejectRed at 15%) */
  rejectBgTint: withAlpha(palette.experienceAdvanced, 0.15),
  /** Low priority / info tinted bg (accentBlue at 15%) */
  blueBgTint: withAlpha(palette.infoBlue, 0.15),
} as const;
