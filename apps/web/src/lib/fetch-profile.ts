import { cache } from 'react';
import { postPublicQuery } from './public-graphql';
import { asUpstream } from './upstream-error';

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

const PROFILE_REVALIDATE_SECONDS = 300;

// Wrapped in React cache() so generateMetadata + the page body (+ opengraph-image)
// share ONE GraphQL POST per request — POST fetches are never memoized by Next's
// request dedup, so each render otherwise re-hit the API 2–3×.
//
// Resolves `null` only when the API answered that the rider is absent. Anything
// else (network failure, timeout, non-200, a GraphQL error other than not-found)
// throws `UpstreamError`, so the page can say it didn't load instead of serving
// a false 404.
export const fetchProfile = cache(async (username: string): Promise<PublicProfile | null> => {
  const data = await asUpstream(
    postPublicQuery<{ getRiderProfile: PublicProfile | null }>(
      API_URL,
      PUBLIC_PROFILE_QUERY,
      { username },
      PROFILE_REVALIDATE_SECONDS,
    ),
    'profile',
  );
  return data?.getRiderProfile ?? null;
});
