import { notFound, redirect } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const TRIP_DETAIL_QUERY = `
  query TripDetailRedirect($tripId: ID!) {
    tripDetail(tripId: $tripId) {
      id
      slug
      countryCode
      regionCode
      title
      description
      difficulty
      dayCount
      status
      visibility
    }
  }
`;

interface PageParams {
  params: Promise<{ country: string }>;
}

interface TripSlugData {
  slug: string | null;
  countryCode: string;
  regionCode?: string | null;
  title?: string;
  description?: string;
  difficulty?: string;
  dayCount?: number;
}

async function lookupTrip(id: string): Promise<TripSlugData | null> {
  // Try discover trips first (published templates)
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
    if (trip?.countryCode) return trip;
  } catch {
    // fall through
  }

  // Fall back to user trips (tripDetail works for public trips without auth)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: TRIP_DETAIL_QUERY,
        variables: { tripId: id },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    const trip = json?.data?.tripDetail;
    if (trip?.countryCode && trip?.visibility === 'public') return trip;
  } catch {
    // fall through
  }

  return null;
}

/**
 * Catch for /trips/[something] where [something] is a single segment.
 *
 * UUID → look up via discoverTripById, then tripDetail.
 * If the trip has a slug → redirect to /trips/:country/:region/:slug.
 * If no slug (user trip) → render a minimal trip page inline.
 */
export default async function TripByIdPage({ params }: PageParams) {
  const { country: segment } = await params;

  if (!UUID_RE.test(segment)) {
    notFound();
  }

  const trip = await lookupTrip(segment);

  if (!trip) {
    notFound();
  }

  // If the trip has a slug, redirect to the canonical URL
  if (trip.slug) {
    const country = trip.countryCode.toLowerCase();
    const region = (trip.regionCode ?? 'general').toLowerCase();
    redirect(`/trips/${country}/${region}/${trip.slug}`);
  }

  // No slug — render inline for user-created public trips
  const difficultyLabel =
    trip.difficulty === 'easy'
      ? 'Easy'
      : trip.difficulty === 'moderate'
        ? 'Moderate'
        : trip.difficulty === 'challenging'
          ? 'Challenging'
          : trip.difficulty === 'expert'
            ? 'Expert'
            : (trip.difficulty ?? '');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <nav className="mb-4 text-sm text-gray-500">
        <a href="/explore" className="hover:underline">
          Explore
        </a>
        {' / '}
        <span>{trip.title ?? 'Trip'}</span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight mb-2">{trip.title ?? 'Trip'}</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {difficultyLabel && (
          <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold capitalize">
            {difficultyLabel}
          </span>
        )}
        {(trip.dayCount ?? 0) > 1 && (
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
            {trip.dayCount} days
          </span>
        )}
      </div>

      {trip.description && (
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-8">{trip.description}</p>
      )}

      <div className="sticky bottom-4 bg-white dark:bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-lg font-bold mb-2">Want to ride this trip?</p>
        <p className="text-sm text-gray-500 mb-3">
          Open in MotoVault to see the full route, waypoints, and details.
        </p>
        <a
          href="https://apps.apple.com/app/motovault/id6738025498"
          className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition"
        >
          Open in App
        </a>
      </div>
    </main>
  );
}
