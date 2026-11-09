/**
 * Spacing — the one home for every gap, padding and margin in the app.
 *
 * Two layers:
 * - `space` — the raw 4pt grid. Use it for spacing inside a component
 *   (icon-to-label, chip padding).
 * - `layout` — semantic spacing for the page itself: how far content sits from
 *   the screen or sheet edge, how far apart sections are. Screens and sheets
 *   read these, so changing one value here moves the whole app at once.
 *
 * `pnpm check:mobile-spacing` blocks NEW raw numbers in padding/margin/gap
 * on changed lines; reach for a token instead.
 *
 * Usage: `<View style={{ paddingHorizontal: layout.sheetGutter, gap: layout.sectionGap }} />`
 */

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

export const layout = {
  /** Side margin of a full-screen page. */
  screenGutter: space.md,
  /** Side margin of a form sheet / modal form (matches iOS system sheets). */
  sheetGutter: space.lg,
  /** Space above a sheet's title, below the grabber. */
  sheetTop: space.lg,
  /** Space between the major sections of a page or sheet. */
  sectionGap: space.xl,
  /** Space between related fields inside one section. */
  fieldGap: space.sm,
  /** Space between a field's label and the field. */
  labelGap: space.xs,
  /** Space between a title and the line directly under it (subtitle, bike name). */
  titleGap: space.xxs,
  /** Space under the last item of a scroll view before its end. */
  scrollEnd: space.xl,
  /** Space above the buttons of a pinned footer. */
  footerTop: space.sm,
  /** Space between a scroll view's last item and the floating tab bar. */
  tabBarGap: space.xl,
} as const;

/** Screen side gutter. */
export const GUTTER = layout.screenGutter;
