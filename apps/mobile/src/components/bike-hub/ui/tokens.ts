import { palette, withAlpha } from '@motovault/design-system';
import { MaintenancePriority } from '@motovault/graphql';
import type { ExpenseCategory } from '@motovault/types';
import type { ParseKeys } from 'i18next';
import type { TextStyle } from 'react-native';
import {
  DUE_TONE,
  type DueTone,
  RIDE_STATUS,
  type RideStatus,
} from '@/lib/bike-hub/constants';
import { TAB_BAR_MIN_INSET } from '@/stores/tab-bar.store';
import { useEditorialTheme } from '@/theme/editorial';
import { PLATE_FONT, SYSTEM_WEIGHT } from '@/theme/type';

/**
 * Semantic colours of the bike hub (DESIGN.md → Colour), one set per scheme.
 * Components read the active set with `useHubTheme()`; tinted borders are
 * derived with `withAlpha` so no colour literal lives in the app. Every text
 * token clears 4.5:1 on `card`, `ground` and `raised` in its scheme.
 */
export const hubDark = {
  ground: palette.plateG0,
  card: palette.plateG1,
  raised: palette.plateG2,
  option: palette.plateG2,
  track: palette.plateG4,
  text: palette.plateInk,
  textSoft: palette.plateInk,
  dim: palette.plateInk2,
  muted: palette.plateInk3,
  /** Action only — never status, never a chart highlight. */
  copper: palette.plateCopper,
  copperText: palette.plateCopperText,
  /** Ink on copper. */
  ink: palette.plateOnPlate,
  late: palette.hubLate,
  /** Due soon as text — the plate's signal yellow. */
  soon: palette.plateSignal,
  low: palette.hubLow,
  ok: palette.hubOk,
  tagCritBg: palette.hubTagCritBg,
  tagHighBg: palette.hubTagHighBg,
  /** Medium priority is graphite, never a hue (the triad is reserved for state). */
  tagMedBg: palette.plateG3,
  tagLowBg: palette.hubTagLowBg,
  hairline: palette.whiteAlpha06,
  hairlineStrong: palette.whiteAlpha08,
  dashed: palette.whiteAlpha18,
  chipOn: palette.hubChipOn,
  chipOnBorder: withAlpha(palette.hubCopperText, 0.5),
  rowCritical: palette.hubRowCritical,
  rowCriticalBorder: withAlpha(palette.hubLate, 0.4),
  /** Chip laid over a photo, and the text on it. */
  photoChip: withAlpha(palette.plateG0, 0.78),
  onPhotoChip: palette.plateInk,
  tabBar: withAlpha(palette.plateG0, 0.96),
  ripple: palette.whiteAlpha10,
  shadow: palette.black,
} as const;

export type HubTheme = { readonly [K in keyof typeof hubDark]: string };
export type HubColorKey = keyof HubTheme;

export const hubLight: HubTheme = {
  ground: palette.plateLightG0,
  card: palette.plateLightG1,
  raised: palette.plateLightG2,
  option: palette.plateLightG2,
  track: palette.plateLightG4,
  text: palette.plateLightInk,
  textSoft: palette.plateLightInk,
  dim: palette.plateLightInk2,
  muted: palette.plateLightMuted,
  copper: palette.plateLightCopper,
  copperText: palette.plateLightCopperText,
  // Dark ink on light copper is only 3.7:1; white is 5:1.
  ink: palette.plateLightG1,
  late: palette.plateLightLate,
  soon: palette.plateLightSoon,
  low: palette.plateLightMuted,
  ok: palette.plateLightOk,
  tagCritBg: palette.plateLightTagCritBg,
  tagHighBg: palette.plateLightTagHighBg,
  tagMedBg: palette.plateLightG3,
  tagLowBg: palette.plateLightTagLowBg,
  hairline: palette.plateLineLight,
  hairlineStrong: withAlpha(palette.plateLightInk, 0.14),
  dashed: withAlpha(palette.plateLightInk, 0.24),
  chipOn: withAlpha(palette.plateLightCopper, 0.1),
  chipOnBorder: withAlpha(palette.plateLightCopper, 0.5),
  rowCritical: palette.plateLightTagCritBg,
  rowCriticalBorder: withAlpha(palette.plateLightLate, 0.35),
  photoChip: withAlpha(palette.plateG0, 0.78),
  onPhotoChip: palette.plateInk,
  tabBar: withAlpha(palette.plateLightG0, 0.96),
  ripple: withAlpha(palette.plateLightInk, 0.08),
  shadow: palette.black,
};

/** The hub colours for the active colour scheme. */
export function useHubTheme(): HubTheme {
  const { isDark } = useEditorialTheme();
  return isDark ? hubDark : hubLight;
}

/**
 * Hub type (Race Plate, DESIGN.md → Typography). Words use the platform's own
 * face via `SYSTEM_WEIGHT` (never a `fontFamily`, so Dynamic Type and the OS
 * face apply); numbers — odometers, amounts, counts, dates — use the condensed
 * plate figures with tabular digits. Spread into a style: `{ ...HUB_FIGURE, fontSize: 15 }`.
 */
export { SYSTEM_WEIGHT };

export const HUB_FIGURE = {
  fontFamily: PLATE_FONT.medium,
  fontVariant: ['tabular-nums'],
} as const satisfies TextStyle;

export const HUB_FIGURE_STRONG = {
  fontFamily: PLATE_FONT.semibold,
  fontVariant: ['tabular-nums'],
} as const satisfies TextStyle;

export const HUB_RADIUS = {
  card: 16,
  button: 14,
  pill: 26,
  segment: 10,
  chip: 10,
  tile: 10,
  tag: 5,
  photoChip: 7,
} as const;

/** Corner radius of the hub's form sheets. */
export const HUB_SHEET_RADIUS = 24;

export const HUB_HEIGHT = { primary: 52, secondary: 48, small: 36 } as const;

/** A row's sub-line wraps to this many lines (as the design does) before it ellipsizes. */
export const HUB_ROW_SUB_LINES = 2;

/** Minimum touch target: 44 pt on iOS, 48 dp on Android. */
export const HUB_TOUCH_TARGET = process.env.EXPO_OS === 'android' ? 48 : 44;

/**
 * The app's floating tab bar (`app/(tabs)/_layout.tsx`) sits
 * `tabBarBottomOffset(inset)` above the bottom edge. Its real height is measured by its own `onLayout`
 * (`useTabBarStore`) — it grows with Dynamic Type / font scale. This is only
 * the fallback until that first layout: the height at the default text size
 * (measured on device, iOS 26.3). Pushed garage screens keep the bar.
 */
export const HUB_TAB_BAR_HEIGHT = 65;
/** The bar's own minimum inset (`stores/tab-bar.store.ts`), so the two cannot drift. */
export const HUB_TAB_BAR_MIN_INSET = TAB_BAR_MIN_INSET;

/** Gap between the top of the tab bar and the floating action pill. */
export const HUB_PILL_GAP = 16;

/** Room above the pill so a last row's right edge (its chevron) can be seen. */
export const HUB_LAST_ROW_MARGIN = 76;

/**
 * Bottom padding a segment's content gets on top of the tab bar, so its last
 * row can always be scrolled clear of the floating action pill.
 */
export const HUB_PILL_CLEARANCE = HUB_PILL_GAP + HUB_HEIGHT.primary + HUB_LAST_ROW_MARGIN;

/**
 * Largest font scale for the hub's chrome — header, odometer chip, segment
 * labels, action pill, sheet titles and the keypad. These sit in fixed-size
 * controls that cannot grow without breaking the layout; at the largest
 * Dynamic Type sizes they stop scaling here (the app's existing cap, see
 * receipt-scan's review card). Body content — rows, cards, notes — is not
 * capped and keeps scaling freely.
 */
export const HUB_CHROME_MAX_FONT_SCALE = 1.3;

export const HUB_PRESSED_SCALE = 0.98;

export const TAG_VARIANT = {
  SAFETY: 'SAFETY',
  DOC: 'DOC',
} as const;
export type TagVariant = (typeof TAG_VARIANT)[keyof typeof TAG_VARIANT];

/** A translation key of `en.json`, so dispatch tables stay checked by the compiler. */
export type HubCopyKey = ParseKeys;

export interface TagStyle {
  labelKey: HubCopyKey;
  /** Keys into the active `HubTheme`: `hub[tag.bg]`, `hub[tag.fg]`. */
  bg: HubColorKey;
  fg: HubColorKey;
}

/** Priority → tag. Priority is always the tag; lateness is always the due line. */
export const PRIORITY_TAG: Record<MaintenancePriority, TagStyle> = {
  [MaintenancePriority.Critical]: { labelKey: 'bikeHub.tag.critical', bg: 'tagCritBg', fg: 'late' },
  [MaintenancePriority.High]: { labelKey: 'bikeHub.tag.high', bg: 'tagHighBg', fg: 'soon' },
  [MaintenancePriority.Medium]: { labelKey: 'bikeHub.tag.medium', bg: 'tagMedBg', fg: 'dim' },
  [MaintenancePriority.Low]: { labelKey: 'bikeHub.tag.low', bg: 'tagLowBg', fg: 'low' },
};

interface TagTone {
  bg: HubColorKey;
  fg: HubColorKey;
}

const TONE_HIGH: TagTone = { bg: 'tagHighBg', fg: 'soon' };
const TONE_CRIT: TagTone = { bg: 'tagCritBg', fg: 'late' };

/** Non-priority tags on attention rows. `critical` picks the CRIT fill for a severe recall. */
export const VARIANT_TAG: Record<
  TagVariant,
  { labelKey: HubCopyKey; normal: TagTone; critical: TagTone }
> = {
  [TAG_VARIANT.SAFETY]: { labelKey: 'bikeHub.tag.safety', normal: TONE_HIGH, critical: TONE_CRIT },
  [TAG_VARIANT.DOC]: { labelKey: 'bikeHub.tag.doc', normal: TONE_HIGH, critical: TONE_CRIT },
};

/** Ride status → its verdict words (the plate itself is drawn by `RideStatusCard`). */
export interface RideStatusStyle {
  titleKey: HubCopyKey;
}

export const RIDE_STATUS_STYLE: Record<RideStatus, RideStatusStyle> = {
  [RIDE_STATUS.NOT_READY]: { titleKey: 'bikeHub.rideStatus.notReady' },
  [RIDE_STATUS.CHECK]: { titleKey: 'bikeHub.rideStatus.check' },
  [RIDE_STATUS.READY]: { titleKey: 'bikeHub.rideStatus.ready' },
  [RIDE_STATUS.UNTRACKED]: { titleKey: 'bikeHub.rideStatus.untracked' },
};

/** Due-line tone → the `HubTheme` key colouring its leading part. */
export const DUE_TONE_COLOR: Record<DueTone, HubColorKey> = {
  [DUE_TONE.LATE]: 'late',
  [DUE_TONE.SOON]: 'soon',
  [DUE_TONE.PLAIN]: 'dim',
};

/**
 * Expense category → its chart / dot colour inside the hub. One hue per
 * category, none of them copper (action only) or a status colour (late, soon,
 * ok, medium), so a bar segment never reads as a warning or a button. The
 * category name always sits beside the colour.
 */
export const HUB_CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  fuel: palette.hubCatFuel,
  maintenance: palette.hubCatService,
  parts: palette.hubCatParts,
  tires: palette.hubCatTires,
  gear: palette.hubCatGear,
  accessories: palette.hubCatAccessories,
  modifications: palette.hubCatMods,
  insurance: palette.hubCatInsurance,
  registration: palette.hubCatRegistration,
  taxes_fees: palette.hubCatTaxes,
  tolls: palette.hubCatTolls,
  parking: palette.hubCatParking,
  training: palette.hubCatTraining,
  other: palette.hubCatOther,
};

export const HUB_CATEGORY_COLOR_LIGHT: Record<ExpenseCategory, string> = {
  fuel: palette.plateLightCatFuel,
  maintenance: palette.plateLightCatService,
  parts: palette.plateLightCatParts,
  tires: palette.plateLightCatTires,
  gear: palette.plateLightCatGear,
  accessories: palette.plateLightCatAccessories,
  modifications: palette.plateLightCatMods,
  insurance: palette.plateLightCatInsurance,
  registration: palette.plateLightCatRegistration,
  taxes_fees: palette.plateLightCatTaxes,
  tolls: palette.plateLightCatTolls,
  parking: palette.plateLightCatParking,
  training: palette.plateLightCatTraining,
  other: palette.plateLightCatOther,
};

/**
 * A category's hub colour in the given scheme's set (dark by default); a key
 * retired from the category table reads as "Other".
 */
export function hubCategoryColor(category: string, theme: HubTheme = hubDark): string {
  const table: Record<string, string> =
    theme === hubLight ? HUB_CATEGORY_COLOR_LIGHT : HUB_CATEGORY_COLOR;
  return table[category] ?? table.other;
}

/**
 * From this font scale (iOS accessibility sizes start at ≈1.65; Android's
 * largest is 2.0) a list row stops putting its tag beside the title and
 * stacks it above, so the title keeps the full width instead of breaking
 * letter by letter.
 */
export const HUB_STACK_FONT_SCALE = 1.5;
