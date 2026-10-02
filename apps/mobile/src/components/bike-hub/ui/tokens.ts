import { palette, withAlpha } from '@motovault/design-system';
import { MaintenancePriority } from '@motovault/graphql';
import type { ParseKeys } from 'i18next';
import {
  DUE_TONE,
  type DueTone,
  RIDE_STATUS,
  type RideStatus,
} from '../../../lib/bike-hub/constants';

/**
 * Semantic colours of the bike hub (DESIGN-SPEC.md §2). The hub is dark in both
 * colour schemes until a light design exists. Tinted borders are derived with
 * `withAlpha` so no colour literal lives in the app.
 */
export const hub = {
  ground: palette.surfaceDark,
  card: palette.cardDark,
  raised: palette.hubRaised,
  option: palette.hubOption,
  track: palette.hubTrack,
  text: palette.hubText,
  textSoft: palette.hubTextSoft,
  dim: palette.hubDim,
  muted: palette.hubMuted,
  /** Action only — never status, never a chart highlight. */
  copper: palette.signature500,
  copperText: palette.hubCopperText,
  /** Ink on copper. */
  ink: palette.hubInk,
  late: palette.hubLate,
  soon: palette.hubSoon,
  medium: palette.hubMedium,
  low: palette.hubLow,
  ok: palette.hubOk,
  tagCritBg: palette.hubTagCritBg,
  tagHighBg: palette.hubTagHighBg,
  hairline: palette.whiteAlpha06,
  hairlineStrong: palette.whiteAlpha08,
  dashed: palette.whiteAlpha18,
  chipOn: palette.hubChipOn,
  chipOnBorder: withAlpha(palette.hubCopperText, 0.5),
  rowCritical: palette.hubRowCritical,
  rowCriticalBorder: withAlpha(palette.hubLate, 0.4),
  photoChip: withAlpha(palette.surfaceDark, 0.78),
  tabBar: withAlpha(palette.surfaceDark, 0.96),
  ripple: palette.whiteAlpha10,
  shadow: palette.black,
} as const;

/**
 * Hub-only font families (lead decision D6). Geist Mono and Plus Jakarta Sans
 * are registered under these keys in `app/_layout.tsx`; the names the rest of
 * the app already uses (`GeistMono*`, `PlusJakartaSans*`) stay unregistered so
 * no other screen changes appearance. One family per weight — do not combine
 * with `fontWeight`.
 */
export const HUB_FONT = {
  serif: 'InstrumentSerif-Regular',
  mono: 'HubMono-Regular',
  monoMedium: 'HubMono-Medium',
  sans: 'HubSans-Regular',
  sansMedium: 'HubSans-Medium',
  sansSemiBold: 'HubSans-SemiBold',
  sansBold: 'HubSans-Bold',
} as const;

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

/** Minimum touch target: 44 pt on iOS, 48 dp on Android. */
export const HUB_TOUCH_TARGET = process.env.EXPO_OS === 'android' ? 48 : 44;

/**
 * The app's floating tab bar (`app/(tabs)/_layout.tsx`) sits `max(inset, 12)`
 * above the bottom edge and is about this tall. Pushed garage screens keep it.
 */
// Measured on device (iOS 26.3): with 76 the pill sat 27 pt above the bar instead of 16.
export const HUB_TAB_BAR_HEIGHT = 65;
export const HUB_TAB_BAR_MIN_INSET = 12;

/**
 * Bottom padding a segment's content gets on top of the tab bar, so its last
 * row can always be scrolled clear of the floating action pill: the pill's
 * offset (16) + its height (52) + room to see the row's right edge (chevrons).
 */
export const HUB_PILL_CLEARANCE = 144;

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
  bg: string;
  fg: string;
}

/** Priority → tag. Priority is always the tag; lateness is always the due line. */
export const PRIORITY_TAG: Record<MaintenancePriority, TagStyle> = {
  [MaintenancePriority.Critical]: {
    labelKey: 'bikeHub.tag.critical',
    bg: palette.hubTagCritBg,
    fg: palette.hubLate,
  },
  [MaintenancePriority.High]: {
    labelKey: 'bikeHub.tag.high',
    bg: palette.hubTagHighBg,
    fg: palette.hubSoon,
  },
  [MaintenancePriority.Medium]: {
    labelKey: 'bikeHub.tag.medium',
    bg: palette.hubTagMedBg,
    fg: palette.hubMedium,
  },
  [MaintenancePriority.Low]: {
    labelKey: 'bikeHub.tag.low',
    bg: palette.hubTagLowBg,
    fg: palette.hubLow,
  },
};

/** Non-priority tags on attention rows. `critical` picks the CRIT fill for a severe recall. */
export const VARIANT_TAG: Record<
  TagVariant,
  { labelKey: HubCopyKey; normal: TagTone; critical: TagTone }
> = {
  [TAG_VARIANT.SAFETY]: {
    labelKey: 'bikeHub.tag.safety',
    normal: { bg: palette.hubTagHighBg, fg: palette.hubSoon },
    critical: { bg: palette.hubTagCritBg, fg: palette.hubLate },
  },
  [TAG_VARIANT.DOC]: {
    labelKey: 'bikeHub.tag.doc',
    normal: { bg: palette.hubTagHighBg, fg: palette.hubSoon },
    critical: { bg: palette.hubTagCritBg, fg: palette.hubLate },
  },
};

interface TagTone {
  bg: string;
  fg: string;
}

export interface RideStatusStyle {
  titleKey: HubCopyKey;
  card: string;
  border: string;
  dot: string;
}

export const RIDE_STATUS_STYLE: Record<RideStatus, RideStatusStyle> = {
  [RIDE_STATUS.NOT_READY]: {
    titleKey: 'bikeHub.rideStatus.notReady',
    card: palette.hubCardNotReady,
    border: withAlpha(palette.hubLate, 0.35),
    dot: palette.hubNotReadyDot,
  },
  [RIDE_STATUS.CHECK]: {
    titleKey: 'bikeHub.rideStatus.check',
    card: palette.hubCardCheck,
    border: withAlpha(palette.hubSoon, 0.35),
    dot: palette.hubSoon,
  },
  [RIDE_STATUS.READY]: {
    titleKey: 'bikeHub.rideStatus.ready',
    card: palette.hubCardReady,
    border: withAlpha(palette.hubOk, 0.3),
    dot: palette.hubOk,
  },
  [RIDE_STATUS.UNTRACKED]: {
    titleKey: 'bikeHub.rideStatus.untracked',
    card: palette.cardDark,
    border: palette.whiteAlpha06,
    dot: palette.hubMuted,
  },
};

/** Due-line tone → colour of the leading part. */
export const DUE_TONE_COLOR: Record<DueTone, string> = {
  [DUE_TONE.LATE]: palette.hubLate,
  [DUE_TONE.SOON]: palette.hubSoon,
  [DUE_TONE.PLAIN]: palette.hubDim,
};
