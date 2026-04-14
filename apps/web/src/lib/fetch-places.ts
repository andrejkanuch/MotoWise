import type { BrowsePlaceFieldsFragment } from '@motovault/graphql';
import {
  BrowseCountriesDocument,
  BrowseCountryBySlugDocument,
  BrowseExploreRegionDocument,
  BrowseRegionsByCountrySlugDocument,
  ExploreDiscoverRoutesDocument,
} from '@motovault/graphql';
import type { BrowsePlace, RouteListItem } from '@motovault/types';
import { gqlServerFetcher } from '@/lib/graphql-server';

/** Alias for `BrowsePlace` — shared type lives in `@motovault/types`. */
export type Place = BrowsePlace;
export type { RouteListItem };

function gqlPlaceToPlace(p: BrowsePlaceFieldsFragment): BrowsePlace {
  const kind =
    p.kind === 'country' || p.kind === 'region' || p.kind === 'city' ? p.kind : 'country';
  return {
    id: p.id,
    kind,
    name: p.name,
    countryCode: p.countryCode,
    regionCode: p.regionCode ?? null,
    slug: p.slug,
    parentId: p.parentId ?? null,
    routeCount: p.routeCount,
  };
}

// ---- Queries (GraphQL API) ----

/** Fetch all countries that have at least 1 route. */
export async function fetchCountries(): Promise<Place[]> {
  const data = await gqlServerFetcher(BrowseCountriesDocument);
  return data.browseCountries.map(gqlPlaceToPlace);
}

/** Fetch a country by its slug (lowercase country code, e.g. "it"). */
export async function fetchCountryBySlug(slug: string): Promise<Place | null> {
  const data = await gqlServerFetcher(BrowseCountryBySlugDocument, { slug });
  const row = data.browseCountryBySlug;
  if (!row) return null;
  return gqlPlaceToPlace(row);
}

/** Fetch regions for a given country slug. */
export async function fetchRegionsByCountrySlug(countrySlug: string): Promise<Place[]> {
  const data = await gqlServerFetcher(BrowseRegionsByCountrySlugDocument, { countrySlug });
  return data.browseRegionsByCountrySlug.map(gqlPlaceToPlace);
}

/** Fetch a region by country slug + region slug. */
export async function fetchRegionBySlug(
  countrySlug: string,
  regionSlug: string,
): Promise<{ country: Place; region: Place } | null> {
  const data = await gqlServerFetcher(BrowseExploreRegionDocument, { countrySlug, regionSlug });
  const bundle = data.browseExploreRegion;
  if (!bundle) return null;
  return {
    country: gqlPlaceToPlace(bundle.country),
    region: gqlPlaceToPlace(bundle.region),
  };
}

function discoverNodeToRouteListItem(node: {
  id: string;
  name?: string | null;
  distanceM: number;
  elevationGainM?: number | null;
  surfaceType?: string | null;
  curvatureIndex?: number | null;
  ratingAvg?: number | null;
  ratingCount: number;
  slug?: string | null;
  countryCode?: string | null;
  regionCode?: string | null;
}): RouteListItem {
  return {
    id: node.id,
    name: node.name ?? null,
    displayName: node.name ?? null,
    distanceM: node.distanceM,
    elevationGainM: node.elevationGainM ?? null,
    surfaceType: node.surfaceType ?? null,
    curvatureIndex: node.curvatureIndex ?? null,
    ratingAvg: node.ratingAvg ?? null,
    ratingCount: node.ratingCount,
    slug: node.slug ?? null,
    countryCode: node.countryCode ?? null,
    regionSlug: node.regionCode ?? null,
  };
}

/** Fetch published routes for a country+region, sorted by rating. */
export async function fetchRoutesByRegion(
  countryCode: string,
  regionSlug: string,
  limit = 50,
): Promise<RouteListItem[]> {
  const data = await gqlServerFetcher(ExploreDiscoverRoutesDocument, {
    filter: {
      sortByRating: true,
      countryCode,
      regionCode: regionSlug,
    },
    first: limit,
  });
  return data.discoverRoutes.edges.map((e) => discoverNodeToRouteListItem(e.node));
}

/** Fetch published routes for a country, sorted by rating. */
export async function fetchRoutesByCountry(
  countryCode: string,
  limit = 50,
): Promise<RouteListItem[]> {
  const data = await gqlServerFetcher(ExploreDiscoverRoutesDocument, {
    filter: {
      sortByRating: true,
      countryCode,
    },
    first: limit,
  });
  return data.discoverRoutes.edges.map((e) => discoverNodeToRouteListItem(e.node));
}
