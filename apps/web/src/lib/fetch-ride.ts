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
    if (json.errors || !json.data?.getPublicRide) return null;
    const ride = json.data.getPublicRide;
    if (!ride.isPublic) return null;
    return ride;
  } catch {
    return null;
  }
}
