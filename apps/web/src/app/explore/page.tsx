import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
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

/** Countries featured in the "Top Countries" grid. Europe + Americas only. */
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

/* ── Revalidation ─────────────────────────────────────────────── */

export const revalidate = 3600;

/* ── Metadata ─────────────────────────────────────────────────── */

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Discover Motorcycle Routes',
    description:
      'Browse the best motorcycle routes worldwide. Staff picks, top-rated rides, and routes near you — all curated by the MotoVault community.',
    alternates: { canonical: `${BASE_URL}/explore` },
    openGraph: {
      title: 'Discover Motorcycle Routes | MotoVault',
      description:
        'Browse the best motorcycle routes worldwide. Staff picks, top-rated rides, and routes near you.',
      url: `${BASE_URL}/explore`,
      siteName: 'MotoVault',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Discover Motorcycle Routes | MotoVault',
      description:
        'Browse the best motorcycle routes worldwide. Staff picks, top-rated rides, and routes near you.',
    },
  };
}

/* ── Supabase admin client (service-role NOT needed — RLS allows public SELECT) ── */

function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  );
}

/* ── Data fetchers ────────────────────────────────────────────── */

type RouteRow = {
  id: string;
  name: string | null;
  description: string | null;
  distance_m: number;
  elevation_gain_m: number | null;
  surface_type: string | null;
  curvature_index: number | null;
  rating_avg: number | null;
  rating_count: number;
  is_motovault_pick: boolean;
  editorial_description: string | null;
};

async function fetchStaffPicks(): Promise<RouteRow[]> {
  const supabase = getSupabaseAnon();
  const { data } = await supabase
    .from('routes')
    .select(
      'id, name, description, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, is_motovault_pick, editorial_description',
    )
    .eq('status', 'published')
    .eq('is_motovault_pick', true)
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(6);
  return (data as RouteRow[]) ?? [];
}

async function fetchTopRoutes(limit = 8): Promise<RouteRow[]> {
  const supabase = getSupabaseAnon();
  const { data } = await supabase
    .from('routes')
    .select(
      'id, name, description, distance_m, elevation_gain_m, surface_type, curvature_index, rating_avg, rating_count, is_motovault_pick, editorial_description',
    )
    .eq('status', 'published')
    .order('rating_avg', { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data as RouteRow[]) ?? [];
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function renderStars(avg: number | null): string {
  if (avg == null) return '--';
  return `${avg.toFixed(1)}`;
}

/* ── Sub-components (server) ──────────────────────────────────── */

function RouteCard({ route }: { route: RouteRow }) {
  return (
    <a
      href={`/route/${route.id}`}
      className="card-lift group block rounded-xl border border-neutral-800 bg-neutral-900 p-5 transition-colors hover:border-neutral-700"
    >
      {/* Surface badge */}
      {route.surface_type && route.surface_type !== 'unknown' && (
        <span className="mb-3 inline-block rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium capitalize text-neutral-300">
          {route.surface_type}
        </span>
      )}

      <h3 className="mb-1 text-lg font-semibold text-neutral-50 group-hover:text-primary-400 transition-colors">
        {route.name ?? 'Unnamed Route'}
      </h3>

      {route.editorial_description ? (
        <p className="mb-3 line-clamp-2 text-sm text-neutral-400">
          {route.editorial_description}
        </p>
      ) : route.description ? (
        <p className="mb-3 line-clamp-2 text-sm text-neutral-400">{route.description}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-400">
        <span>{formatDistance(route.distance_m)}</span>
        {route.elevation_gain_m != null && (
          <span>{Math.round(route.elevation_gain_m)} m gain</span>
        )}
        {route.rating_avg != null && (
          <span className="flex items-center gap-1 text-warm-400">
            <StarIcon />
            {renderStars(route.rating_avg)}
            <span className="text-neutral-500">({route.rating_count})</span>
          </span>
        )}
      </div>
    </a>
  );
}

function StarIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function SectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-xl bg-neutral-800/60"
        />
      ))}
    </div>
  );
}

/* ── Async section components (for Suspense boundaries) ───────── */

async function StaffPicksSection() {
  const picks = await fetchStaffPicks();
  if (picks.length === 0) return null;

  return (
    <section className="reveal-on-scroll">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signature-500/20 text-signature-400">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
          </svg>
        </span>
        <h2 className="text-2xl font-bold text-neutral-50">Staff Picks</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </section>
  );
}

async function TopRoutesSection({ countryCode }: { countryCode: string }) {
  const routes = await fetchTopRoutes(8);
  if (routes.length === 0) return null;
  const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;

  return (
    <section className="reveal-on-scroll">
      <h2 className="mb-6 text-2xl font-bold text-neutral-50">
        Top Routes in {countryName}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </section>
  );
}

async function NearYouSection({ countryCode }: { countryCode: string }) {
  const routes = await fetchTopRoutes(6);
  if (routes.length === 0) return null;
  const countryName = COUNTRY_NAMES[countryCode] ?? countryCode;

  return (
    <section className="reveal-on-scroll">
      <h2 className="mb-6 text-2xl font-bold text-neutral-50">
        Near You &mdash; {countryName}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      urlTemplate: 'https://motovault.app/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

/* ── Page ─────────────────────────────────────────────────────── */

export default async function ExplorePage() {
  const hdrs = await headers();
  const countryCode = hdrs.get('cf-ipcountry')?.toUpperCase() ?? 'US';

  return (
    <div className="dark grain-overlay min-h-screen bg-neutral-950 text-neutral-50">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* Hero + Search */}
      <section className="relative overflow-hidden px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        {/* Gradient background */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 0%, var(--color-primary-950) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl lg:text-6xl">
            Discover Motorcycle Routes
          </h1>
          <p className="mb-8 text-lg text-neutral-400 sm:text-xl">
            Explore the best rides curated by the MotoVault community. Search by
            name, region, or surface type.
          </p>

          {/* Search bar */}
          <form
            action="/search"
            method="GET"
            className="mx-auto flex max-w-xl items-center gap-2"
          >
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                type="search"
                name="q"
                placeholder="Search routes..."
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 py-3 pl-11 pr-4 text-neutral-50 placeholder:text-neutral-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
                aria-label="Search motorcycle routes"
              />
            </div>
            <button
              type="submit"
              className="cta-primary rounded-xl bg-primary-500 px-6 py-3 font-semibold text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-neutral-950"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Content sections */}
      <div className="mx-auto max-w-7xl space-y-16 px-4 pb-24 sm:px-6 lg:px-8">
        {/* Near You */}
        <Suspense fallback={<SectionSkeleton />}>
          <NearYouSection countryCode={countryCode} />
        </Suspense>

        {/* Staff Picks */}
        <Suspense fallback={<SectionSkeleton />}>
          <StaffPicksSection />
        </Suspense>

        {/* Top Routes in Country */}
        <Suspense fallback={<SectionSkeleton />}>
          <TopRoutesSection countryCode={countryCode} />
        </Suspense>

        {/* Top Countries Grid */}
        <section className="reveal-on-scroll">
          <h2 className="mb-6 text-2xl font-bold text-neutral-50">Top Countries</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {TOP_COUNTRIES.map(({ code, emoji }) => (
              <a
                key={code}
                href={`/explore/${code.toLowerCase()}`}
                className="card-lift group flex flex-col items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-6 text-center transition-colors hover:border-neutral-700"
              >
                <span className="text-3xl" role="img" aria-label={COUNTRY_NAMES[code]}>
                  {emoji}
                </span>
                <span className="text-sm font-medium text-neutral-300 group-hover:text-neutral-50 transition-colors">
                  {COUNTRY_NAMES[code]}
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
