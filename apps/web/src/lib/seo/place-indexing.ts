/**
 * Threshold for indexing place pages (countries/regions).
 * Pages below this route count get `noindex` + sitemap exclusion.
 * Defined as a constant so it can be changed without a DB migration.
 */
export const PLACE_INDEX_MIN_ROUTES = 8;

export const isIndexable = (place: { routeCount: number }) =>
  place.routeCount >= PLACE_INDEX_MIN_ROUTES;
