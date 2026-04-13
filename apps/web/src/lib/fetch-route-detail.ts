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

const ROUTE_REVIEWS_QUERY = `
  query GetRouteReviews($routeId: ID!, $first: Int) {
    getRouteReviews(routeId: $routeId, first: $first) {
      reviews {
        id
        rating
        text
        conditionTags
        createdAt
        author {
          id
          displayName
          publicUsername
          avatarUrl
        }
        bike {
          make
          model
          year
        }
      }
      hasNextPage
      endCursor
      totalCount
    }
  }
`;

export interface RouteContributor {
  id: string;
  displayName: string;
  publicUsername?: string;
  avatarUrl?: string;
}

export interface RouteDetail {
  id: string;
  name?: string;
  description?: string;
  polyline: string;
  distanceM: number;
  elevationGainM?: number;
  surfaceType?: string;
  curvatureIndex?: number;
  isMotovaultPick: boolean;
  editorialDescription?: string;
  ratingAvg?: number;
  ratingCount: number;
  commentCount: number;
  status: string;
  createdAt: string;
  contributor: RouteContributor;
}

export interface RouteReviewAuthor {
  id: string;
  displayName: string;
  publicUsername?: string;
  avatarUrl?: string;
}

export interface RouteReviewBike {
  make: string;
  model: string;
  year: number;
}

export interface RouteReview {
  id: string;
  rating: number;
  text?: string;
  conditionTags: string[];
  createdAt: string;
  author: RouteReviewAuthor;
  bike?: RouteReviewBike;
}

export interface RouteReviewsData {
  reviews: RouteReview[];
  hasNextPage: boolean;
  endCursor?: string;
  totalCount: number;
}

export async function fetchRouteDetail(routeId: string): Promise<RouteDetail | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ROUTE_DETAIL_QUERY,
        variables: { routeId },
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

export async function fetchRouteReviews(
  routeId: string,
  first = 10,
): Promise<RouteReviewsData | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ROUTE_REVIEWS_QUERY,
        variables: { routeId, first },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.getRouteReviews) return null;
    return json.data.getRouteReviews;
  } catch {
    return null;
  }
}
