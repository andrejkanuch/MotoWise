import type { TripTemplateNode } from '@/lib/fetch-places';

/**
 * Pick sibling routes for internal linking on a trip detail page.
 *
 * - Drops the current trip and any trip missing slug/region/country (those would
 *   render a `/trips//` link that soft-404s — the class blog-internal-links
 *   guards for `/blog/`).
 * - Prefers same-region trips, falling back to country-wide only when the region
 *   has fewer than `minSameRegion` siblings.
 */
export function selectSiblingRoutes(
  all: TripTemplateNode[],
  region: string,
  currentSlug: string,
  limit = 6,
  minSameRegion = 3,
): TripTemplateNode[] {
  const others = all.filter(
    (t) =>
      t.slug != null &&
      t.regionCode != null &&
      t.countryCode != null &&
      t.slug.toLowerCase() !== currentSlug.toLowerCase(),
  );
  const sameRegion = others.filter((t) => t.regionCode?.toLowerCase() === region.toLowerCase());
  return (sameRegion.length >= minSameRegion ? sameRegion : others).slice(0, limit);
}

/**
 * Whether every selected sibling is actually in `region` — so a region-scoped
 * heading is accurate rather than mislabeling country-wide fallback results.
 */
export function siblingsAreRegionScoped(routes: TripTemplateNode[], region: string): boolean {
  return (
    routes.length > 0 && routes.every((t) => t.regionCode?.toLowerCase() === region.toLowerCase())
  );
}
