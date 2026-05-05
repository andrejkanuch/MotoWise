import { PublicSavedTripsDocument, type PublicSavedTripsQuery } from '@motovault/graphql';
import { gqlServerFetcher } from './graphql-server';

export type SavedTripNode =
  PublicSavedTripsQuery['publicSavedTrips']['edges'][number]['node'];

/** @deprecated Use SavedTripNode instead */
export type SavedRouteNode = SavedTripNode;

export interface SavedTripsResponse {
  edges: PublicSavedTripsQuery['publicSavedTrips']['edges'];
  pageInfo: PublicSavedTripsQuery['publicSavedTrips']['pageInfo'];
}

/** @deprecated Use SavedTripsResponse instead */
export type SavedRoutesResponse = SavedTripsResponse;

/**
 * Fetch a user's public saved trips by handle.
 */
export async function fetchSavedTrips(
  handle: string,
  first = 20,
  after?: string,
): Promise<SavedTripsResponse | null> {
  try {
    const data = await gqlServerFetcher(PublicSavedTripsDocument, {
      handle,
      first,
      after,
    });
    return data.publicSavedTrips;
  } catch {
    return null;
  }
}

/**
 * @deprecated Use fetchSavedTrips instead.
 */
export const fetchSavedRoutes = fetchSavedTrips;
