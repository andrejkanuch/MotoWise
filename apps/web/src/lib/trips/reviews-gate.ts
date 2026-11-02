/**
 * Whether a trip page must fail its render because the reviews did not load.
 *
 * The trip page is cached for 30 days, so a "reviews didn't load" note would
 * stick for the whole window. A rated trip with no reviews answer (`null`)
 * throws instead: a failed regeneration keeps the last good page, and a first
 * render is retried on the next request. An unrated trip shows no reviews, and
 * `[]` is a real answer (ratings only), so neither needs the reviews.
 */
export function reviewsBlockRender(
  hasRating: boolean,
  reviews: readonly unknown[] | null,
): boolean {
  return hasRating && reviews === null;
}
