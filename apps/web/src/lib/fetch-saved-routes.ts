/**
 * @deprecated This file fetches saved *routes* via publicSavedRoutes.
 * TODO: Migrate to publicSavedTrips once the resolver exists in
 * apps/api/src/modules/trips/trips.resolver.ts. The new query should
 * accept (handle, first, after) and return TripConnection with fields
 * matching SavedTripNode below. When ready:
 *   1. Add publicSavedTrips resolver (public, takes handle arg)
 *   2. Create web .graphql operation for it
 *   3. Swap the query + types in this file (or replace entirely)
 *   4. Update saved-routes-client.tsx query string
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const PUBLIC_SAVED_ROUTES_QUERY = `
  query PublicSavedRoutes($handle: String!, $first: Int, $after: String) {
    publicSavedRoutes(handle: $handle, first: $first, after: $after) {
      edges {
        node {
          id
          name
          distanceM
          elevationGainM
          surfaceType
          isMotovaultPick
          ratingAvg
          ratingCount
          commentCount
          contributor {
            id
            displayName
            publicUsername
            avatarUrl
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/** @deprecated Use SavedTripNode once publicSavedTrips resolver exists */
export interface SavedRouteNode {
  id: string;
  name?: string;
  distanceM: number;
  elevationGainM?: number;
  surfaceType?: string;
  isMotovaultPick: boolean;
  ratingAvg?: number;
  ratingCount: number;
  commentCount: number;
  contributor: {
    id: string;
    displayName: string;
    publicUsername?: string;
    avatarUrl?: string;
  };
}

/** Alias for forward-compatibility — same shape until the API migrates */
export type SavedTripNode = SavedRouteNode;

/** @deprecated Use SavedTripsResponse once publicSavedTrips resolver exists */
export interface SavedRoutesResponse {
  edges: Array<{
    node: SavedRouteNode;
    cursor: string;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
}

/** Alias for forward-compatibility */
export type SavedTripsResponse = SavedRoutesResponse;

/**
 * Fetch a user's public saved trips (currently backed by publicSavedRoutes).
 * @deprecated Will be replaced by a publicSavedTrips query.
 */
export async function fetchSavedTrips(
  handle: string,
  first = 20,
  after?: string,
): Promise<SavedTripsResponse | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: PUBLIC_SAVED_ROUTES_QUERY,
        variables: { handle, first, after },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.publicSavedRoutes) return null;
    return json.data.publicSavedRoutes;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use fetchSavedTrips instead.
 */
export const fetchSavedRoutes = fetchSavedTrips;
