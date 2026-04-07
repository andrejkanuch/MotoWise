const API_URL = process.env.API_URL ?? 'https://motowise.onrender.com/graphql';

const PUBLIC_PROFILE_QUERY = `
  query PublicProfile($username: String!) {
    publicProfile(username: $username) {
      id
      displayName
      username
      city
      bio
      avatarUrl
      bikes {
        make
        model
        year
        nickname
      }
      stats {
        totalRides
        totalDistanceM
        totalDurationS
        joinedAt
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

export interface ProfileStats {
  totalRides: number;
  totalDistanceM: number;
  totalDurationS: number;
  joinedAt: string;
}

export interface PublicProfile {
  id: string;
  displayName: string;
  username: string;
  city?: string;
  bio?: string;
  avatarUrl?: string;
  bikes: ProfileBike[];
  stats: ProfileStats;
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
    if (json.errors || !json.data?.publicProfile) return null;
    return json.data.publicProfile;
  } catch {
    return null;
  }
}
