/**
 * Race Plate type system (DESIGN.md → Typography). Five roles, no more:
 *
 * - `plate`  — condensed racing numerals on a bike plate (the signature move).
 * - `figure` — condensed numerals for stats, amounts and odometers.
 * - `title`  — condensed large titles for screens and sheets; system semibold
 *              for section titles.
 * - `body`   — the platform's own UI face (SF Pro on iOS, Roboto on Android).
 * - `label`  — small system labels and captions, in sentence case.
 *
 * Condensed faces carry numbers and titles only. Everything a rider reads as a
 * sentence stays on the system face so it follows Dynamic Type / font scale.
 * There is no serif and no italic anywhere in the app.
 *
 * Usage: `<Text style={[type.body, { color: t.ink }]}>`
 */

import type { TextStyle, ViewStyle } from 'react-native';

/** Registered in `app/_layout.tsx` from `@expo-google-fonts/barlow-condensed`. */
export const PLATE_FONT = {
  medium: 'PlateCondensed-Medium',
  semibold: 'PlateCondensed-SemiBold',
  bold: 'PlateCondensed-Bold',
} as const;

const IS_ANDROID = process.env.EXPO_OS === 'android';

/** System-face weights. Never set `fontFamily` with these — the OS face is the point. */
export const SYSTEM_WEIGHT = {
  regular: { fontWeight: '400' },
  medium: { fontWeight: '500' },
  semibold: { fontWeight: '600' },
  bold: { fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

export const type = {
  // ── plate ────────────────────────────────────────────────────────────────
  plate: {
    fontFamily: PLATE_FONT.semibold,
    fontSize: 64,
    lineHeight: 64,
    letterSpacing: -0.5,
    fontVariant: TABULAR,
  },
  plateCompact: {
    fontFamily: PLATE_FONT.semibold,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: -0.3,
    fontVariant: TABULAR,
  },
  // ── figure ───────────────────────────────────────────────────────────────
  figure: {
    fontFamily: PLATE_FONT.semibold,
    fontSize: 28,
    lineHeight: 30,
    fontVariant: TABULAR,
  },
  figureSmall: {
    fontFamily: PLATE_FONT.medium,
    fontSize: 20,
    lineHeight: 22,
    fontVariant: TABULAR,
  },
  // ── title ────────────────────────────────────────────────────────────────
  largeTitle: {
    fontFamily: PLATE_FONT.bold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: 0.2,
  },
  sheetTitle: {
    fontFamily: PLATE_FONT.semibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0.2,
  },
  sectionTitle: {
    ...SYSTEM_WEIGHT.semibold,
    fontSize: 20,
    lineHeight: 25,
  },
  // ── body ─────────────────────────────────────────────────────────────────
  body: {
    ...SYSTEM_WEIGHT.regular,
    fontSize: IS_ANDROID ? 16 : 17,
    lineHeight: IS_ANDROID ? 24 : 22,
  },
  bodyStrong: {
    ...SYSTEM_WEIGHT.semibold,
    fontSize: IS_ANDROID ? 16 : 17,
    lineHeight: IS_ANDROID ? 24 : 22,
  },
  subhead: {
    ...SYSTEM_WEIGHT.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  // ── label ────────────────────────────────────────────────────────────────
  label: {
    ...SYSTEM_WEIGHT.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    ...SYSTEM_WEIGHT.regular,
    fontSize: 12,
    lineHeight: 16,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeRole = keyof typeof type;

/** The 4pt grid. Every gap, padding and margin is one of these. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** Corner radii. Continuous curves on iOS (`borderCurve: 'continuous'`). */
export const radius = {
  plate: 20,
  card: 16,
  control: 12,
  chip: 10,
  pill: 999,
} as const;

/** Screen side gutter. */
export const GUTTER = space.md;

/**
 * Readable column width. On a phone it is wider than the screen, so nothing
 * changes; on a tablet content stops at this width and centres instead of
 * stretching edge to edge.
 */
export const CONTENT_MAX_WIDTH = 720;

/** Apply to a screen's scroll content container (or its inner column). */
export const readableWidth = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} as const satisfies ViewStyle;
