import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BASE_URL } from '@/lib/constants';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const DISCOVER_TRIP_BY_SLUG_QUERY = `
  query DiscoverTripBySlug($country: String!, $region: String!, $slug: String!) {
    discoverTripBySlug(country: $country, region: $region, slug: $slug) {
      id
      slug
      title
      description
      difficulty
      dayCount
      waypoints {
        sortOrder
        dayIndex
        type
        name
        lat
        lng
        notes
      }
      startLat
      startLng
      countryCode
      regionCode
      city
      distanceM
      elevationGainM
      estimatedDurationMinutes
      surfaceType
      isFeatured
      isMotovaultPick
      viewCount
      cloneCount
      averageRating
      reviewCount
      publishedAt
      updatedAt
      contributor {
        displayName
        publicUsername
      }
    }
  }
`;

interface TripData {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  dayCount: number;
  waypoints: Array<{
    sortOrder: number;
    dayIndex: number;
    type: string;
    name: string;
    lat: number;
    lng: number;
    notes?: string | null;
  }>;
  startLat?: number | null;
  startLng?: number | null;
  countryCode: string;
  regionCode?: string | null;
  city?: string | null;
  distanceM?: number | null;
  elevationGainM?: number | null;
  estimatedDurationMinutes?: number | null;
  surfaceType?: string | null;
  isFeatured: boolean;
  isMotovaultPick: boolean;
  viewCount: number;
  cloneCount: number;
  averageRating?: number | null;
  reviewCount: number;
  publishedAt: string;
  updatedAt: string;
  contributor: {
    displayName: string;
    publicUsername?: string | null;
  };
}

interface PageParams {
  params: Promise<{ country: string; region: string; slug: string }>;
}

async function fetchTrip(country: string, region: string, slug: string): Promise<TripData | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: DISCOVER_TRIP_BY_SLUG_QUERY,
        variables: { country, region, slug },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    return json?.data?.discoverTripBySlug ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { country, region, slug } = await params;
  const trip = await fetchTrip(country, region, slug);
  if (!trip) return { title: 'Trip Not Found' };

  const countryName = countryDisplayName(trip.countryCode);
  const regionName = trip.regionCode ? regionDisplayName(trip.countryCode, trip.regionCode) : null;
  const title = `${trip.title} — ${trip.dayCount}-Day Motorcycle Trip${regionName ? ` in ${regionName}` : ''}, ${countryName}`;
  const description = trip.description.slice(0, 155);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/trips/${country}/${region}/${slug}`,
      type: 'article',
    },
    alternates: {
      canonical: `${BASE_URL}/trips/${country}/${region}/${slug}`,
    },
  };
}

export const revalidate = 300;

const WAYPOINT_LABELS: Record<string, string> = {
  start: 'Start',
  end: 'End',
  fuel: 'Fuel Stop',
  food: 'Restaurant',
  scenic: 'Scenic Point',
  overnight: 'Overnight',
  photo: 'Photo Spot',
  mechanical: 'Mechanical',
  ferry: 'Ferry',
  pass_summit: 'Mountain Pass',
  rally_point: 'Rally Point',
};

export default async function TripPage({ params }: PageParams) {
  const { country, region, slug } = await params;
  const trip = await fetchTrip(country, region, slug);
  if (!trip) notFound();

  const countryName = countryDisplayName(trip.countryCode);
  const regionName = trip.regionCode ? regionDisplayName(trip.countryCode, trip.regionCode) : null;

  // Group waypoints by day
  const waypointsByDay = new Map<number, TripData['waypoints']>();
  for (const wp of trip.waypoints) {
    const day = waypointsByDay.get(wp.dayIndex) ?? [];
    day.push(wp);
    waypointsByDay.set(wp.dayIndex, day);
  }
  const days = [...waypointsByDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayIndex, waypoints]) => ({
      dayIndex,
      waypoints: waypoints.sort((a, b) => a.sortOrder - b.sortOrder),
    }));

  // JSON-LD structured data (TouristTrip)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: trip.title,
    description: trip.description,
    touristType: 'Motorcycle touring',
    itinerary: {
      '@type': 'ItemList',
      numberOfItems: trip.waypoints.length,
      itemListElement: trip.waypoints.map((wp, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'TouristAttraction',
          name: wp.name,
          geo: {
            '@type': 'GeoCoordinates',
            latitude: wp.lat,
            longitude: wp.lng,
          },
        },
      })),
    },
    ...(trip.averageRating != null && trip.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: trip.averageRating,
            reviewCount: trip.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-500">
        <a href="/explore" className="hover:underline">
          Explore
        </a>
        {' / '}
        <a href={`/explore/${country}`} className="hover:underline">
          {countryName}
        </a>
        {regionName && (
          <>
            {' / '}
            <span>{regionName}</span>
          </>
        )}
      </nav>

      {/* Title */}
      <h1 className="text-3xl font-bold tracking-tight mb-2">{trip.title}</h1>

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span
          className="px-3 py-1 rounded-full text-xs font-bold capitalize"
          style={{
            backgroundColor:
              trip.difficulty === 'easy'
                ? '#dcfce7'
                : trip.difficulty === 'moderate'
                  ? '#dbeafe'
                  : trip.difficulty === 'challenging'
                    ? '#fef3c7'
                    : '#fee2e2',
            color:
              trip.difficulty === 'easy'
                ? '#166534'
                : trip.difficulty === 'moderate'
                  ? '#1e40af'
                  : trip.difficulty === 'challenging'
                    ? '#92400e'
                    : '#991b1b',
          }}
        >
          {trip.difficulty}
        </span>
        {trip.dayCount > 1 && (
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
            {trip.dayCount} days
          </span>
        )}
        {trip.isMotovaultPick && (
          <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
            MotoVault Pick
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
        {trip.distanceM != null && (
          <div>
            <p className="text-2xl font-bold">{Math.round(trip.distanceM / 1000)} km</p>
            <p className="text-sm text-gray-500">Distance</p>
          </div>
        )}
        {(trip.elevationGainM ?? 0) > 0 && (
          <div>
            <p className="text-2xl font-bold">{Math.round(trip.elevationGainM ?? 0)} m</p>
            <p className="text-sm text-gray-500">Elevation</p>
          </div>
        )}
        {trip.averageRating != null && trip.reviewCount > 0 && (
          <div>
            <p className="text-2xl font-bold">{trip.averageRating.toFixed(1)}</p>
            <p className="text-sm text-gray-500">{trip.reviewCount} reviews</p>
          </div>
        )}
        {trip.cloneCount > 0 && (
          <div>
            <p className="text-2xl font-bold">{trip.cloneCount}</p>
            <p className="text-sm text-gray-500">Clones</p>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-8">{trip.description}</p>

      {/* Contributor */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
          {trip.contributor.displayName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold">{trip.contributor.displayName}</p>
          {trip.contributor.publicUsername && (
            <p className="text-sm text-gray-500">@{trip.contributor.publicUsername}</p>
          )}
        </div>
      </div>

      {/* Day-by-day itinerary */}
      {days.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Itinerary</h2>
          {days.map(({ dayIndex, waypoints }) => (
            <div key={dayIndex} className="mb-6">
              {trip.dayCount > 1 && (
                <h3 className="text-lg font-semibold text-blue-600 mb-3">Day {dayIndex + 1}</h3>
              )}
              <div className="space-y-3">
                {waypoints.map((wp, i) => (
                  <div
                    key={wp.id ?? `${dayIndex}-${i}`}
                    className="flex items-start gap-3 pl-4 border-l-2 border-gray-200 dark:border-gray-700"
                  >
                    <div>
                      <p className="font-medium">{wp.name}</p>
                      <p className="text-sm text-gray-500 capitalize">
                        {WAYPOINT_LABELS[wp.type] ?? wp.type}
                      </p>
                      {wp.notes && <p className="text-sm text-gray-500 mt-1">{wp.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Clone CTA */}
      <div className="sticky bottom-4 bg-white dark:bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 text-center">
        <p className="text-lg font-bold mb-2">Want to ride this trip?</p>
        <p className="text-sm text-gray-500 mb-3">
          Clone it to your planner, customize dates and stops, then ride.
        </p>
        <a
          href="https://apps.apple.com/app/motovault/id6738025498"
          className="inline-block bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition"
        >
          Clone in App
        </a>
      </div>
    </main>
  );
}
