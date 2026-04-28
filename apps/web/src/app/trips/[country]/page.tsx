import { notFound, redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Try the public discoverTripById first (template trips).
 * If that errors, fall back to tripDetail (user trips — may require auth,
 * but we only need slug/country/region for a redirect).
 */
const DISCOVER_TRIP_BY_ID_QUERY = `
  query DiscoverTripByIdRedirect($id: ID!) {
    discoverTripById(id: $id) {
      id
      slug
      countryCode
      regionCode
    }
  }
`;

interface PageParams {
  params: Promise<{ country: string }>;
}

interface TripSlugData {
  slug: string;
  countryCode: string;
  regionCode?: string | null;
}

async function lookupTripById(id: string): Promise<TripSlugData | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: DISCOVER_TRIP_BY_ID_QUERY,
        variables: { id },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    const trip = json?.data?.discoverTripById;
    if (trip?.slug && trip?.countryCode) return trip;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Catch for /trips/[something] where [something] is a single segment.
 *
 * If the segment is a UUID → look up the discover trip by ID and redirect
 * to the canonical /trips/:country/:region/:slug URL.
 *
 * Otherwise → notFound (country browse pages can be added later).
 */
export default async function TripByIdPage({ params }: PageParams) {
  const { country: segment } = await params;

  if (!UUID_RE.test(segment)) {
    notFound();
  }

  const trip = await lookupTripById(segment);

  if (!trip) {
    notFound();
  }

  const country = trip.countryCode.toLowerCase();
  const region = (trip.regionCode ?? 'general').toLowerCase();

  redirect(`/trips/${country}/${region}/${trip.slug}`);
}
