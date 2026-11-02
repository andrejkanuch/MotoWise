import { cache } from 'react';
import { ABSENT_OR_MALFORMED_CODES, postPublicQuery } from './public-graphql';
import { asUpstream } from './upstream-error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const PUBLIC_RIDE_QUERY = `
  query GetPublicRide($id: String!) {
    getPublicRide(id: $id) {
      id
      name
      distanceM
      durationS
      elevationGain
      elevationLoss
      startedAt
      endedAt
      routeThumbnailUri
      motorcycleId
      isPublic
    }
  }
`;

export interface PublicRide {
  id: string;
  name?: string;
  distanceM?: number;
  durationS?: number;
  elevationGain?: number;
  elevationLoss?: number;
  startedAt: string;
  endedAt?: string;
  routeThumbnailUri?: string;
  motorcycleId?: string;
  isPublic: boolean;
}

const RIDE_REVALIDATE_SECONDS = 300;

// Wrapped in React cache() so generateMetadata + the page body (+ opengraph-image)
// share ONE GraphQL POST per request (POST fetches aren't deduped by Next).
//
// Resolves `null` only when the API answered that the ride is absent or private.
// Anything else (network failure, timeout, non-200, a GraphQL error other than
// not-found) throws `UpstreamError`, so the page can say it didn't load instead
// of serving a false 404.
export const fetchRide = cache(async (id: string): Promise<PublicRide | null> => {
  const data = await asUpstream(
    postPublicQuery<{ getPublicRide: PublicRide | null }>(
      API_URL,
      PUBLIC_RIDE_QUERY,
      { id },
      RIDE_REVALIDATE_SECONDS,
      // A non-UUID id is rejected by the resolver's ParseUUIDPipe: no such ride.
      ABSENT_OR_MALFORMED_CODES,
    ),
    'ride',
  );
  const ride = data?.getPublicRide;
  if (!ride?.isPublic) return null;
  return ride;
});
