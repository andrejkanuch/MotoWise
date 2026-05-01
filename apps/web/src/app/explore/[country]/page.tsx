import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BASE_URL, getHreflangMap } from '@/lib/constants';
import {
  fetchCountryBySlug,
  fetchRegionsByCountrySlug,
  fetchTripTemplatesByCountry,
  type TripTemplateNode,
} from '@/lib/fetch-places';

export const revalidate = 86400;

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ country: string }>;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

/** PostgREST / drivers may return `numeric` as string — never call `.toFixed` on a string. */
function formatElevation(meters: number): string {
  return `${Math.round(meters).toLocaleString()} m`;
}

function surfaceLabel(surfaceType: string): string {
  switch (surfaceType) {
    case 'paved':
      return 'Paved';
    case 'mixed':
      return 'Mixed';
    case 'off-road':
      return 'Off-Road';
    default:
      return '';
  }
}

/* ── Metadata ────────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return {};

  const title = `Motorcycle Routes in ${country.name}`;
  const rc = country.routeCount;
  const description =
    rc > 0
      ? `Explore ${rc} motorcycle route${rc === 1 ? '' : 's'} in ${country.name}. Twisty roads, scenic passes, and rides rated by riders on MotoVault.`
      : `Motorcycle routes in ${country.name} are coming soon. Browse other countries on MotoVault or share a ride from the app.`;

  const canonical = `${BASE_URL}/explore/${countrySlug}`;
  const base: Metadata = {
    title: { absolute: `${title} | MotoVault` },
    description,
    alternates: {
      canonical,
      languages: getHreflangMap(`/explore/${countrySlug}`),
    },
    openGraph: {
      title: `${title} | MotoVault`,
      description,
      url: canonical,
      siteName: 'MotoVault',
      type: 'website',
      images: [{ url: OG_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | MotoVault`,
      description,
      images: [OG_IMAGE],
    },
  };

  return base;
}

/* ── Icon components ─────────────────────────────────────────── */

function DistanceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ElevationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M12 19V5m-5 5l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-3.5 shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`size-3.5 ${filled ? 'fill-warm-400 text-warm-400' : 'fill-neutral-700 text-neutral-700'}`}
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

/* ── Trip Template Card ─────────────────────────────────────── */

function getDifficultyDisplay(difficulty: string): { label: string; colorClass: string } {
  switch (difficulty) {
    case 'expert':
      return { label: 'Expert', colorClass: 'bg-red-500/15 text-red-400' };
    case 'hard':
      return { label: 'Hard', colorClass: 'bg-orange-500/15 text-orange-400' };
    case 'moderate':
      return { label: 'Moderate', colorClass: 'bg-yellow-500/15 text-yellow-400' };
    default:
      return { label: 'Easy', colorClass: 'bg-green-500/15 text-green-400' };
  }
}

function TripTemplateCard({ trip, index }: { trip: TripTemplateNode; index: number }) {
  const diff = getDifficultyDisplay(trip.difficulty);

  return (
    <a
      href={
        trip.slug && trip.countryCode && trip.regionCode
          ? `/trips/${trip.countryCode.toLowerCase()}/${trip.regionCode.toLowerCase()}/${trip.slug}`
          : `/trips/${trip.id}`
      }
      className="route-card group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800/40 bg-neutral-900/40 transition-all duration-300 hover:border-neutral-700/60 hover:bg-neutral-900/60"
      style={{ animationDelay: `${Math.min(index * 80, 500)}ms` }}
    >
      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-neutral-50 transition-colors group-hover:text-warm-400">
          {trip.title}
        </h3>

        {trip.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-neutral-400">{trip.description}</p>
        )}

        {/* Stats */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-neutral-300">
          {trip.distanceM != null && trip.distanceM > 0 && (
            <span className="flex items-center gap-1">
              <DistanceIcon />
              {formatDistance(trip.distanceM)}
            </span>
          )}
          {trip.elevationGainM != null && (
            <span className="flex items-center gap-1">
              <ElevationIcon />
              {formatElevation(trip.elevationGainM)}
            </span>
          )}
          {trip.estimatedDurationMinutes != null && trip.estimatedDurationMinutes > 0 && (
            <span className="flex items-center gap-1">
              <ClockIcon />
              {trip.estimatedDurationMinutes < 60
                ? `${trip.estimatedDurationMinutes} min`
                : `${Math.floor(trip.estimatedDurationMinutes / 60)}h ${trip.estimatedDurationMinutes % 60 > 0 ? `${trip.estimatedDurationMinutes % 60}m` : ''}`}
            </span>
          )}
          {trip.dayCount != null && trip.dayCount > 1 && <span>{trip.dayCount} days</span>}
        </div>

        {/* Rating + difficulty */}
        <div className="mt-auto flex items-center gap-2.5 pt-3">
          {trip.averageRating != null && trip.reviewCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5" aria-hidden="true">
                {([0, 1, 2, 3, 4] as const).map((i) => (
                  <StarIcon
                    key={`${trip.id}-star-${i}`}
                    filled={i < Math.round(trip.averageRating ?? 0)}
                  />
                ))}
              </div>
              <span className="text-xs text-neutral-300">{trip.averageRating.toFixed(1)}</span>
            </div>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${diff.colorClass}`}>
            {diff.label}
          </span>
          {trip.surfaceType && trip.surfaceType !== 'unknown' && (
            <span className="text-xs text-neutral-400">{surfaceLabel(trip.surfaceType)}</span>
          )}
        </div>
      </div>
    </a>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default async function CountryPage({ params }: PageProps) {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) notFound();

  const [regions, tripTemplates] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug).catch(() => []),
    fetchTripTemplatesByCountry(country.countryCode, 12).catch(() => []),
  ]);

  return (
    <main className="min-h-screen text-neutral-50">
      {/* Stagger animation styles */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS keyframe animations for card entrance
        dangerouslySetInnerHTML={{
          __html: `
        .route-card {
          opacity: 0;
          transform: translateY(12px);
          animation: routeCardIn 0.4s ease-out forwards;
        }
        @keyframes routeCardIn {
          to { opacity: 1; transform: translateY(0); }
        }
        .region-pill {
          opacity: 0;
          animation: pillIn 0.3s ease-out forwards;
        }
        @keyframes pillIn {
          to { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .route-card, .region-pill {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `,
        }}
      />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6 sm:px-6 sm:pt-14 sm:pb-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-sm text-neutral-400"
        >
          <a href="/explore" className="transition-colors hover:text-neutral-200">
            Explore
          </a>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-3.5"
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-neutral-300">{country.name}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
          Motorcycle Routes in {country.name}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-400">
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-warm-500/15">
              <DistanceIcon />
            </span>
            <strong className="font-semibold text-neutral-200">{country.routeCount}</strong> route
            {country.routeCount !== 1 ? 's' : ''}
          </span>
          {regions.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-500/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-3.5"
                  aria-hidden="true"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <strong className="font-semibold text-neutral-200">{regions.length}</strong> region
              {regions.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </section>

      {/* Region pills */}
      {regions.length > 0 && (
        <section
          aria-label={`Regions in ${country.name}`}
          className="mx-auto max-w-6xl px-4 pb-8 sm:px-6"
        >
          <h2 className="sr-only">Regions</h2>
          <div className="flex flex-wrap gap-2">
            {regions.map((region, i) => (
              <a
                key={region.id}
                href={`/explore/${countrySlug}/${region.slug}`}
                className="region-pill min-h-[44px] rounded-full border border-neutral-800/50 bg-neutral-900/30 px-4 py-2.5 text-sm text-neutral-300 transition-all hover:border-warm-500/40 hover:bg-neutral-900/60 hover:text-white"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                {region.name}
                {region.routeCount > 0 && (
                  <span className="ml-1.5 text-neutral-500">{region.routeCount}</span>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Divider */}
      {tripTemplates.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="h-px bg-neutral-800/40" />
        </div>
      )}

      {/* Trips */}
      {tripTemplates.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xl font-bold text-neutral-50 sm:text-2xl">
              Top Routes in {country.name}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tripTemplates.map((trip, i) => (
              <TripTemplateCard key={trip.id} trip={trip} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {tripTemplates.length === 0 && (
        <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-900/50">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="size-8 text-neutral-600"
              aria-hidden="true"
            >
              <path d="M3 12h4l3-9 4 18 3-9h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-300">No routes yet</h2>
          <p className="mt-2 text-neutral-500">
            Routes in {country.name} are coming soon. Share your favorite ride from the MotoVault
            app to be the first!
          </p>
          <a
            href="/explore"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-800/50 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            Browse other countries
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </section>
      )}
    </main>
  );
}
