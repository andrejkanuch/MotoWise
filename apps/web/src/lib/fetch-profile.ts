import { cache } from 'react';
import { UpstreamError } from './upstream-error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const PUBLIC_PROFILE_QUERY = `
  query GetRiderProfile($username: String!) {
    getRiderProfile(username: $username) {
      id
      publicUsername
      displayName
      bio
      city
      avatarUrl
      followerCount
      followingCount
      isFollowing
      bikes {
        make
        model
        year
        nickname
      }
      rideStats {
        totalRides
        totalDistance
        joinDate
      }
    }
  }
`;

export interface ProfileBike {
  make: string;
  model: string;
  year: number;
  nickname?: string;
}

export interface ProfileRideStats {
  totalRides: number;
  totalDistance: number;
  joinDate?: string;
}

export interface PublicProfile {
  id: string;
  publicUsername: string;
  displayName?: string;
  bio?: string;
  city?: string;
  avatarUrl?: string;
  followerCount: number;
  followingCount: number;
  isFollowing?: boolean;
  bikes: ProfileBike[];
  rideStats: ProfileRideStats;
}

// Wrapped in React cache() so generateMetadata + the page body (+ opengraph-image)
// share ONE GraphQL POST per request — POST fetches are never memoized by Next's
// request dedup, so each render otherwise re-hit the API 2–3×.
//
// Resolves `null` only when the API answered and the rider is absent. A network
// failure or a non-200 status throws `UpstreamError`, so the page can say it
// didn't load instead of serving a false 404.
export const fetchProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: PUBLIC_PROFILE_QUERY,
        variables: { username },
      }),
      next: { revalidate: 300 },
    });
  } catch {
    throw new UpstreamError('profile fetch failed');
  }
  if (!res.ok) throw new UpstreamError(`profile fetch ${res.status}`);
  const json = await res.json().catch(() => {
    throw new UpstreamError('profile fetch bad json');
  });
  if (json.errors || !json.data?.getRiderProfile) return null;
  return json.data.getRiderProfile;
});
