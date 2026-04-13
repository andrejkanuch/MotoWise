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

export async function fetchSavedRoutes(
  handle: string,
  first = 20,
  after?: string,
): Promise<SavedRoutesResponse | null> {
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
