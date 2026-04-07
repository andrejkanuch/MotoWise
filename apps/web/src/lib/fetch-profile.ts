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

export async function fetchProfile(username: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: PUBLIC_PROFILE_QUERY,
        variables: { username },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.getRiderProfile) return null;
    return json.data.getRiderProfile;
  } catch {
    return null;
  }
}
