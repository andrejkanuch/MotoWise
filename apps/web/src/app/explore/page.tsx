import type { ExploreRouteDbRow } from '@motovault/types';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import { Suspense } from 'react';

/* ── Constants ────────────────────────────────────────────────── */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://motovault.app';

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  DE: 'Germany',
  AT: 'Austria',
  CH: 'Switzerland',
  IT: 'Italy',
  ES: 'Spain',
  FR: 'France',
  GB: 'United Kingdom',
  PT: 'Portugal',
  GR: 'Greece',
  HR: 'Croatia',
  NO: 'Norway',
  SE: 'Sweden',
  RO: 'Romania',
  CZ: 'Czech Republic',
  SK: 'Slovakia',
  SI: 'Slovenia',
  BA: 'Bosnia and Herzegovina',
  ME: 'Montenegro',
  AL: 'Albania',
  MK: 'North Macedonia',
  BG: 'Bulgaria',
  RS: 'Serbia',
  PL: 'Poland',
  BR: 'Brazil',
  AR: 'Argentina',
  MX: 'Mexico',
  CO: 'Colombia',
  CL: 'Chile',
  CA: 'Canada',
};

const TOP_COUNTRIES = [
  { code: 'IT', emoji: '\u{1F1EE}\u{1F1F9}' },
  { code: 'ES', emoji: '\u{1F1EA}\u{1F1F8}' },
  { code: 'AT', emoji: '\u{1F1E6}\u{1F1F9}' },
  { code: 'DE', emoji: '\u{1F1E9}\u{1F1EA}' },
  { code: 'FR', emoji: '\u{1F1EB}\u{1F1F7}' },
  { code: 'CH', emoji: '\u{1F1E8}\u{1F1ED}' },
  { code: 'HR', emoji: '\u{1F1ED}\u{1F1F7}' },
  { code: 'GR', emoji: '\u{1F1EC}\u{1F1F7}' },
  { code: 'NO', emoji: '\u{1F1F3}\u{1F1F4}' },
  { code: 'RO', emoji: '\u{1F1F7}\u{1F1F4}' },
  { code: 'PT', emoji: '\u{1F1F5}\u{1F1F9}' },
  { code: 'US', emoji: '\u{1F1FA}\u{1F1F8}' },
] as const;

const TOP_ROUTES_SEO = [
  'Pacific Coast Highway',
  'Transfagarasan',
  'Stelvio Pass',
  'Grossglockner',
  'Tail of the Dragon',
  'Route Napoleon',
  'Trollstigen',
  'Ruta 40',
  'Furka Pass',
  'Black Forest B500',
];

const SECTION_SKELETON_KEYS = ['a', 'b', 'c', 'd'] as const;

const TOP_REGIONS_SEO = [
  'Dolomites, Italy',
  'Black Forest, Germany',
  'Andalusia, Spain',
  'Scottish Highlands',
  'Norwegian Fjords',
  'Transylvania, Romania',
  'Swiss Alps',
  'Provence, France',
  'Croatian Coast',
  'Blue Ridge, USA',
];

/* ── Revalidation ─────────────────────────────────────────────── */

export const revalidate = 3600;

/* ── Metadata ─────────────────────────────────────────────────── */

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Discover Motorcycle Routes | MotoVault',
    description:
      "Browse the best motorcycle routes worldwide. Editor's picks, top-rated rides, and routes near you — curated by riders, for riders.",
    alternates: { canonical: `${BASE_URL}/explore` },
    openGraph: {
      title: 'Discover Motorcycle Routes | MotoVault',
      description:
        "Browse the best motorcycle routes worldwide. Editor's picks, top-rated rides, and routes near you.",
      url: `${BASE_URL}/explore`,
      siteName: 'MotoVault',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Discover Motorcycle Routes | MotoVault',
      description: 'Browse the best motorcycle routes worldwide — curated by riders, for riders.',
    },
  };
}

/* ── Supabase ─────────────────────────────────────────────────── */

function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}

/* ── Data fetchers ────────────────────────────────────────────── */

async function fetchStaffPicks(): Promise<ExploreRouteDbRow[]> {
  const supabase = getSupabaseAnon();
  const { data } = await supabase
    .from('routes')
    .select(
      'id, name, description, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, is_motovault_pick, editorial_description, slug, country_code, region_code',
    )
    .eq('status', 'published')
    .eq('is_motovault_pick', true)
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(6);
  return (data as ExploreRouteDbRow[]) ?? [];
}

async function fetchTopRoutes(limit = 8, countryCode?: string): Promise<ExploreRouteDbRow[]> {
  const supabase = getSupabaseAnon();
  let query = supabase
    .from('routes')
    .select(
      'id, name, description, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, is_motovault_pick, editorial_description, slug, country_code, region_code',
    )
    .eq('status', 'published')
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (countryCode) {
    query = query.eq('country_code', countryCode.toLowerCase());
  }
  const { data } = await query;
  return (data as ExploreRouteDbRow[]) ?? [];
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function getDifficulty(route: ExploreRouteDbRow): { label: string; color: string } {
  const ci = route.curvature_index ?? 0;
  const elev = route.elevation_gain_m ?? 0;
  if (ci >= 50 || elev >= 2000) return { label: 'Expert', color: 'text-red-400' };
  if (ci >= 30 || elev >= 1000) return { label: 'Hard', color: 'text-orange-400' };
  if (ci >= 15 || elev >= 500) return { label: 'Moderate', color: 'text-yellow-400' };
  return { label: 'Easy', color: 'text-green-400' };
}

function estimateTime(distanceM: number, surfaceType?: string | null): string {
  const avgSpeed = surfaceType === 'off-road' ? 25 : surfaceType === 'mixed' ? 40 : 60;
  const hours = distanceM / 1000 / avgSpeed;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ── Route Card ──────────────────────────────────────────────── */

const ROUTE_IMAGES = [
  '/images/route-card-placeholder.jpg',
  '/images/route-coastal.jpg',
  '/images/route-forest.jpg',
];

function RouteCard({ route, priority = false }: { route: ExploreRouteDbRow; priority?: boolean }) {
  const difficulty = getDifficulty(route);
  // Deterministic image based on route ID hash
  const imageIndex = route.id.charCodeAt(0) % ROUTE_IMAGES.length;
  const imageSrc = ROUTE_IMAGES[imageIndex];

  return (
    <a
      href={
        route.slug && route.country_code && route.region_code
          ? `/route/${route.country_code}/${route.region_code}/${route.slug}`
          : `/routes/${route.id}`
      }
      className="group relative block overflow-hidden rounded-2xl bg-neutral-900 transition-all duration-300 hover:ring-1 hover:ring-neutral-700"
    >
      {/* Route photo */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={imageSrc}
          alt={route.name ?? 'Route'}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          priority={priority}
        />

        {/* Save icon overlay — decorative in server component, wired in client */}
        <span
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950/60 text-neutral-300 backdrop-blur-sm"
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <title>Save route</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </span>

        {/* Editor's Pick badge */}
        {route.is_motovault_pick && (
          <span className="absolute left-3 top-3 rounded-full bg-signature-500/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            Editor&apos;s Pick
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-0.5 truncate text-base font-semibold text-neutral-50 group-hover:text-primary-300 transition-colors">
          {route.name ?? 'Unnamed Route'}
        </h3>

        {(route.editorial_description || route.description) && (
          <p className="mb-2 line-clamp-1 text-sm text-neutral-500">
            {route.editorial_description ?? route.description}
          </p>
        )}

        {/* Stats row — matching AllTrails pattern: ★ 4.8 · ◆ Hard · 27 km · Est. 3h */}
        <div className="flex flex-wrap items-center gap-x-1.5 text-sm text-neutral-400">
          {route.rating_avg != null && (
            <>
              <span className="flex items-center gap-0.5 text-signature-400">
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Rating</title>
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
                </svg>
                <span className="font-medium text-neutral-200">{route.rating_avg.toFixed(1)}</span>
              </span>
              <span className="text-neutral-600">&middot;</span>
            </>
          )}
          <span className={difficulty.color}>{difficulty.label}</span>
          <span className="text-neutral-600">&middot;</span>
          <span>{formatDistance(route.distance_m)}</span>
          <span className="text-neutral-600">&middot;</span>
          <span>Est. {estimateTime(route.distance_m, route.surface_type)}</span>
        </div>
      </div>
    </a>
  );
}

/* ── Skeleton ────────────────────────────────────────────────── */

function SectionSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-${cols}`}>
      {SECTION_SKELETON_KEYS.slice(0, cols).map((slot) => (
        <div key={slot} className="animate-pulse overflow-hidden rounded-2xl bg-neutral-900">
          <div className="aspect-[4/3] bg-neutral-800/60" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 rounded bg-neutral-800" />
            <div className="h-3 w-1/2 rounded bg-neutral-800/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Async sections ──────────────────────────────────────────── */

async function NearYouSection({ countryCode }: { countryCode: string }) {
  const routes = await fetchTopRoutes(4, countryCode);
  if (routes.length === 0) {
    return (
      <section>
        <h2 className="mb-6 text-xl font-bold text-neutral-50 sm:text-2xl">Routes near you</h2>
        <div className="rounded-2xl border border-dashed border-neutral-800 py-16 text-center">
          <p className="text-neutral-500">No routes found in your area yet.</p>
          <a
            href="/explore"
            className="mt-2 inline-block text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
          >
            Search all routes &rarr;
          </a>
        </div>
      </section>
    );
  }
  const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-neutral-50 sm:text-2xl">
          Routes near <span className="text-primary-400">{countryName}</span>
        </h2>
        <a
          href="/explore"
          className="text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          View all &rarr;
        </a>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </section>
  );
}

async function StaffPicksSection() {
  const picks = await fetchStaffPicks();
  if (picks.length === 0) return null;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-signature-500/20">
            <svg
              className="h-4 w-4 text-signature-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <title>Editor&apos;s picks</title>
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
            </svg>
          </span>
          <h2 className="text-xl font-bold text-neutral-50 sm:text-2xl">Editor&apos;s Picks</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((route) => (
          <RouteCard key={route.id} route={route} priority />
        ))}
      </div>
    </section>
  );
}

async function TopRoutesSection() {
  const routes = await fetchTopRoutes(8);
  if (routes.length === 0) return null;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-neutral-50 sm:text-2xl">Top rated routes</h2>
        <a
          href="/explore"
          className="text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          View all &rarr;
        </a>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </section>
  );
}

/* ── JSON-LD ──────────────────────────────────────────────────── */

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: 'https://motovault.app',
  name: 'MotoVault',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://motovault.app/explore?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

/* ── Page ─────────────────────────────────────────────────────── */

export default async function ExplorePage() {
  const hdrs = await headers();
  const countryCode = hdrs.get('cf-ipcountry')?.toUpperCase() ?? 'US';

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* ━━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden sm:min-h-[80vh]">
        {/* Background — real hero photo with dark overlay */}
        <Image
          src="/images/hero-explore.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
          aria-hidden
        />
        <div className="absolute inset-0 bg-neutral-950/50" aria-hidden="true" />
        {/* Subtle noise texture */}
        <div className="grain-overlay pointer-events-none absolute inset-0" aria-hidden="true" />
        {/* Bottom fade to content */}
        <div
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-neutral-950 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-signature-400">
            Curated by riders, for riders
          </p>
          <h1 className="mb-6 text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[0.95] tracking-tight">
            Discover your
            <br />
            next ride
          </h1>
          <p className="mb-10 text-lg text-neutral-400 sm:text-xl">
            Browse the best motorcycle routes worldwide &mdash; from alpine passes to coastal
            highways.
          </p>

          {/* Search bar — full-width, prominent */}
          <form action="/explore" method="GET" className="mx-auto max-w-2xl">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <title>Search</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="Search by country, region, or route name..."
                className="w-full rounded-2xl border border-neutral-700/50 bg-neutral-900/80 py-4 pl-13 pr-32 text-base text-neutral-50 placeholder:text-neutral-500 backdrop-blur-xl focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                aria-label="Search motorcycle routes"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-primary-500 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-400 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
              >
                Search
              </button>
            </div>
          </form>

          <a
            href="/explore"
            className="mt-4 inline-block text-sm font-medium text-neutral-400 underline decoration-neutral-700 underline-offset-4 hover:text-neutral-200 hover:decoration-neutral-500 transition-colors"
          >
            Explore nearby routes
          </a>
        </div>
      </section>

      {/* ━━━ CONTENT SECTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Near You — 20px top margin to connect with hero */}
        <div className="mt-8">
          <Suspense fallback={<SectionSkeleton cols={4} />}>
            <NearYouSection countryCode={countryCode} />
          </Suspense>
        </div>

        {/* Editor's Picks */}
        <div className="mt-20">
          <Suspense fallback={<SectionSkeleton cols={3} />}>
            <StaffPicksSection />
          </Suspense>
        </div>

        {/* App Promotion — breaks the card pattern */}
        <div className="mt-24">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-primary-950/30">
            <div className="grid items-center gap-8 p-8 sm:grid-cols-2 sm:p-12 lg:p-16">
              <div>
                <p className="mb-2 text-sm font-medium uppercase tracking-widest text-signature-400">
                  MotoVault App
                </p>
                <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                  Track every ride.
                  <br />
                  Share every road.
                </h2>
                <p className="mb-6 max-w-md text-neutral-400">
                  Record rides with live GPS tracking, log expenses, diagnose issues with AI, and
                  discover routes shared by riders worldwide.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="https://apps.apple.com/us/app/motovault/id6760291360"
                    className="inline-flex items-center gap-2 rounded-xl bg-neutral-50 px-5 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <title>Apple App Store</title>
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    App Store
                  </a>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.motovault.app"
                    className="inline-flex items-center gap-2 rounded-xl bg-neutral-50 px-5 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <title>Google Play</title>
                      <path d="M3.18 23.73c-.5-.32-.68-.84-.68-1.43V1.7c0-.59.18-1.11.68-1.43L13.84 12 3.18 23.73zm1.8.6L16.92 13.6l-2.79-2.79L4.98 24.33zm17.28-11.37c.53.3.74.71.74 1.04s-.21.74-.74 1.04l-3.21 1.81-3.07-3.07 3.07-3.07 3.21 1.25zM4.98-.33L14.13 10.4l2.79-2.79L4.98-.33z" />
                    </svg>
                    Google Play
                  </a>
                </div>
              </div>
              <div className="relative mx-auto w-64 sm:w-72">
                {/* Phone frame placeholder */}
                <div className="aspect-[9/19] overflow-hidden rounded-[2.5rem] border-4 border-neutral-700 bg-neutral-800">
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <div className="mb-4 h-16 w-16 rounded-2xl bg-primary-500/20" />
                    <p className="text-sm font-medium text-neutral-400">App Preview</p>
                    <p className="mt-1 text-xs text-neutral-600">Live ride tracking</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Routes */}
        <div className="mt-20">
          <Suspense fallback={<SectionSkeleton cols={4} />}>
            <TopRoutesSection />
          </Suspense>
        </div>

        {/* Top Countries */}
        <div className="mt-20">
          <h2 className="mb-6 text-xl font-bold text-neutral-50 sm:text-2xl">Explore by country</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {TOP_COUNTRIES.map(({ code, emoji }) => (
              <a
                key={code}
                href={`/explore/${code.toLowerCase()}`}
                className="group flex items-center gap-3 rounded-xl border border-neutral-800/50 bg-neutral-900/50 px-4 py-4 transition-all hover:border-neutral-700 hover:bg-neutral-800/50 active:scale-[0.98]"
              >
                <span className="text-2xl" role="img" aria-label={COUNTRY_NAMES[code]}>
                  {emoji}
                </span>
                <span className="text-sm font-medium text-neutral-300 group-hover:text-neutral-100 transition-colors">
                  {COUNTRY_NAMES[code]}
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* ━━━ SEO FOOTER — "Ride anywhere" ━━━━━━━━━━━━━━━━━━━ */}
        <div className="mt-24 border-t border-neutral-800/50 pt-16 pb-20">
          <h2 className="mb-10 text-2xl font-bold tracking-tight sm:text-3xl">Ride anywhere</h2>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Top routes
              </h3>
              <ul className="space-y-2">
                {TOP_ROUTES_SEO.map((name) => (
                  <li key={name}>
                    <a
                      href={`/explore`}
                      className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Top regions
              </h3>
              <ul className="space-y-2">
                {TOP_REGIONS_SEO.map((name) => (
                  <li key={name}>
                    <a
                      href={`/explore`}
                      className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Top countries
              </h3>
              <ul className="space-y-2">
                {TOP_COUNTRIES.map(({ code }) => (
                  <li key={code}>
                    <a
                      href={`/explore/${code.toLowerCase()}`}
                      className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      {COUNTRY_NAMES[code]}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
