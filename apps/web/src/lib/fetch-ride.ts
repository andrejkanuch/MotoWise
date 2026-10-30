import { cache } from 'react';
import { UpstreamError } from './upstream-error';

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

// Wrapped in React cache() so generateMetadata + the page body (+ opengraph-image)
// share ONE GraphQL POST per request (POST fetches aren't deduped by Next).
//
// Resolves `null` only when the API answered and the ride is absent or private.
// A network failure or a non-200 status throws `UpstreamError`, so the page can
// say it didn't load instead of serving a false 404.
export const fetchRide = cache(async (id: string): Promise<PublicRide | null> => {
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: PUBLIC_RIDE_QUERY,
        variables: { id },
      }),
      next: { revalidate: 300 },
    });
  } catch {
    throw new UpstreamError('ride fetch failed');
  }
  if (!res.ok) throw new UpstreamError(`ride fetch ${res.status}`);
  const json = await res.json().catch(() => {
    throw new UpstreamError('ride fetch bad json');
  });
  if (json.errors || !json.data?.getPublicRide) return null;
  const ride = json.data.getPublicRide;
  if (!ride.isPublic) return null;
  return ride;
});
