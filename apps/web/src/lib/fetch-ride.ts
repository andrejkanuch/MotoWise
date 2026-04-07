const API_URL = process.env.API_URL ?? 'https://motowise.onrender.com/graphql';

const PUBLIC_RIDE_QUERY = `
  query PublicRide($id: ID!) {
    publicRide(id: $id) {
      id
      name
      distanceM
      durationS
      elevationGainM
      avgSpeedMps
      aiSummary
      routeThumbnailUri
      startedAt
      isPublic
      bike {
        make
        model
        year
        nickname
      }
      rider {
        displayName
        username
      }
    }
  }
`;

export interface PublicRide {
  id: string;
  name?: string;
  distanceM: number;
  durationS: number;
  elevationGainM?: number;
  avgSpeedMps?: number;
  aiSummary?: string;
  routeThumbnailUri?: string;
  startedAt: string;
  isPublic: boolean;
  bike?: {
    make: string;
    model: string;
    year: number;
    nickname?: string;
  };
  rider: {
    displayName: string;
    username: string;
  };
}

export async function fetchRide(id: string): Promise<PublicRide | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: PUBLIC_RIDE_QUERY,
        variables: { id },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.publicRide) return null;
    const ride = json.data.publicRide;
    if (!ride.isPublic) return null;
    return ride;
  } catch {
    return null;
  }
}
