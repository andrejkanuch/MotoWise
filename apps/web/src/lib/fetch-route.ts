const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const ROUTE_DETAIL_QUERY = `
  query RouteDetail($routeId: ID!) {
    routeDetail(routeId: $routeId) {
      id
      name
      description
      polyline
      distanceM
      elevationGainM
      surfaceType
      curvatureIndex
      isMotovaultPick
      editorialDescription
      ratingAvg
      ratingCount
      commentCount
      status
      createdAt
      contributor {
        id
        displayName
        publicUsername
        avatarUrl
      }
    }
  }
`;

export interface RouteDetail {
  id: string;
  name: string | null;
  description: string | null;
  polyline: string;
  distanceM: number;
  elevationGainM: number | null;
  surfaceType: string | null;
  curvatureIndex: number | null;
  isMotovaultPick: boolean;
  editorialDescription: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  commentCount: number;
  status: string;
  createdAt: string;
  contributor: {
    id: string;
    displayName: string;
    publicUsername: string | null;
    avatarUrl: string | null;
  };
}

/**
 * Fetch a route by its URL slug parts.
 *
 * The slug is currently the route UUID. Country and region are used for
 * SEO-friendly URLs but the lookup is by ID extracted from the slug.
 */
export async function fetchRouteBySlug(
  _country: string,
  _region: string,
  slug: string,
): Promise<RouteDetail | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ROUTE_DETAIL_QUERY,
        variables: { routeId: slug },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.routeDetail) return null;
    return json.data.routeDetail;
  } catch {
    return null;
  }
}
