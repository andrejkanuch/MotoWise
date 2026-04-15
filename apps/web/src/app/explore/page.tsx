import type { ExploreDiscoverRoutesQuery } from '@motovault/graphql';
import { ExploreDiscoverRoutesDocument } from '@motovault/graphql';
import type { ExploreRouteDbRow } from '@motovault/types';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import { Suspense } from 'react';
import { SaveRouteButton } from '@/components/save-route-button';
import { TypeaheadSearch } from '@/components/typeahead-search';
import { BASE_URL } from '@/lib/constants';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';

type ExploreRouteNode = ExploreDiscoverRoutesQuery['discoverRoutes']['edges'][number]['node'];

/* ── Constants ────────────────────────────────────────────────── */

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
  { name: 'Pacific Coast Highway', href: '/route/us/ca/pacific-coast-highway' },
  { name: 'Transfagarasan', href: '/route/ro/ag/transfgran' },
  { name: 'Stelvio Pass', href: '/route/it/taa/stelvio-pass' },
  { name: 'Grossglockner', href: '/route/at/k/grossglockner-hochalpenstrae' },
  { name: 'Tail of the Dragon', href: '/route/us/tn/tail-of-the-dragon' },
  { name: 'Col du Galibier', href: '/route/fr/paca/col-du-galibier' },
  { name: 'Trollstigen', href: '/route/no/mr/trollstigen' },
  { name: 'Sa Calobra', href: '/route/es/ib/sa-calobra' },
  { name: 'Furka Pass', href: '/route/ch/vs/furka-pass' },
  { name: 'Grimsel Pass', href: '/route/ch/vs/grimsel-pass' },
] as const;

const SECTION_SKELETON_KEYS = ['a', 'b', 'c', 'd'] as const;

const TOP_REGIONS_SEO = [
  { name: 'Dolomites, Italy', href: '/explore/it' },
  { name: 'Black Forest, Germany', href: '/explore/de' },
  { name: 'Andalusia, Spain', href: '/explore/es' },
  { name: 'Scottish Highlands', href: '/explore/gb' },
  { name: 'Norwegian Fjords', href: '/explore/no' },
  { name: 'Transylvania, Romania', href: '/explore/ro' },
  { name: 'Swiss Alps', href: '/explore/ch' },
  { name: 'Provence, France', href: '/explore/fr' },
  { name: 'Croatian Coast', href: '/explore/hr' },
  { name: 'Blue Ridge, USA', href: '/explore/us' },
] as const;

/* ── Revalidation ─────────────────────────────────────────────── */

export const revalidate = 3600;

/* ── Metadata ─────────────────────────────────────────────────── */

const EXPLORE_OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Discover Motorcycle Routes | MotoVault';
  const description =
    "Browse the best motorcycle routes worldwide. Editor's picks, top-rated rides, and routes near you — curated by riders, for riders.";

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${BASE_URL}/explore` },
    openGraph: {
      title,
      description:
        "Browse the best motorcycle routes worldwide. Editor's picks, top-rated rides, and routes near you.",
      url: `${BASE_URL}/explore`,
      siteName: 'MotoVault',
      type: 'website',
      images: [{ url: EXPLORE_OG_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: 'Browse the best motorcycle routes worldwide — curated by riders, for riders.',
      images: [EXPLORE_OG_IMAGE],
    },
  };
}

/* ── Data (GraphQL API — public discoverRoutes) ─────────────────── */

function nodeToExploreRow(node: ExploreRouteNode): ExploreRouteDbRow {
  return {
    id: node.id,
    name: node.name ?? null,
    description: node.description ?? null,
    distance_m: node.distanceM,
    elevation_gain_m: node.elevationGainM ?? null,
    surface_type: node.surfaceType ?? null,
    curvature_index: node.curvatureIndex ?? null,
    rating_avg: node.ratingAvg ?? null,
    rating_count: node.ratingCount,
    is_motovault_pick: node.isMotovaultPick,
    editorial_description: node.editorialDescription ?? null,
    slug: node.slug ?? null,
    country_code: node.countryCode ?? null,
    region_code: node.regionCode ?? null,
  };
}

async function fetchExploreRoutes(
  first: number,
  options: { countryCode?: string; motovaultPicksOnly?: boolean } = {},
): Promise<ExploreRouteDbRow[]> {
  try {
    const data = await gqlServerFetcher(ExploreDiscoverRoutesDocument, {
      filter: {
        sortByRating: true,
        ...(options.countryCode ? { countryCode: options.countryCode } : {}),
        ...(options.motovaultPicksOnly ? { motovaultPicksOnly: true } : {}),
      },
      first,
    });
    return data.discoverRoutes.edges.map((e) => nodeToExploreRow(e.node));
  } catch {
    return [];
  }
}

async function fetchStaffPicks(): Promise<ExploreRouteDbRow[]> {
  return fetchExploreRoutes(6, { motovaultPicksOnly: true });
}

async function fetchTopRoutes(limit = 8, countryCode?: string): Promise<ExploreRouteDbRow[]> {
  return fetchExploreRoutes(limit, { countryCode });
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

        {/* Save button */}
        <span className="absolute right-3 top-3">
          <SaveRouteButton routeId={route.id} />
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

async function NearYouSection({ countryCode }: { countryCode: string | undefined }) {
  // If we have a country code, fetch routes for that country.
  // If not, fetch top routes globally (no country filter).
  const routes = await fetchTopRoutes(4, countryCode);
  if (routes.length === 0) {
    return null;
  }
  const countryName = countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode) : null;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xl font-bold text-neutral-50 sm:text-2xl">
          {countryName ? (
            <>
              Routes near <span className="text-primary-400">{countryName}</span>
            </>
          ) : (
            'Popular routes'
          )}
        </h2>
        <a
          href="/explore"
          className="text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-200"
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

/** WebSite only — no SearchAction (explore has no URL-backed search results page). */
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: BASE_URL,
  name: 'MotoVault',
};

/* ── Page ─────────────────────────────────────────────────────── */

/**
 * Detect the user's country from request headers.
 *
 * Priority order:
 * 1. Cloudflare `cf-ipcountry` — set when behind Cloudflare
 * 2. Vercel `x-vercel-ip-country` — set on Vercel deployments
 * 3. Render / generic `x-country-code` — custom proxy header
 * 4. Accept-Language header — parse primary language locale (e.g. "sk" → "SK")
 * 5. Fallback to undefined (show global content, no "near you" bias)
 */
function detectCountry(hdrs: Headers): string | undefined {
  // Direct geo headers from CDN/proxy
  const cf = hdrs.get('cf-ipcountry');
  if (cf && cf !== 'XX' && cf !== 'T1') return cf.toUpperCase();

  const vercel = hdrs.get('x-vercel-ip-country');
  if (vercel) return vercel.toUpperCase();

  const custom = hdrs.get('x-country-code');
  if (custom) return custom.toUpperCase();

  // Infer from Accept-Language (best effort — language ≠ country but usually close)
  const acceptLang = hdrs.get('accept-language');
  if (acceptLang) {
    // Parse first locale with region: "sk-SK,sk;q=0.9,en-US;q=0.8" → "SK"
    const regionMatch = acceptLang.match(/[a-z]{2}-([A-Z]{2})/);
    if (regionMatch) return regionMatch[1];

    // Fallback: map primary language to likely country
    const langMatch = acceptLang.match(/^([a-z]{2})/);
    if (langMatch) {
      const LANG_TO_COUNTRY: Record<string, string> = {
        sk: 'SK',
        cs: 'CZ',
        de: 'DE',
        fr: 'FR',
        it: 'IT',
        es: 'ES',
        pt: 'PT',
        nl: 'NL',
        pl: 'PL',
        ro: 'RO',
        hr: 'HR',
        el: 'GR',
        no: 'NO',
        sv: 'SE',
        da: 'DK',
        fi: 'FI',
        hu: 'HU',
        bg: 'BG',
        sl: 'SI',
        et: 'EE',
        lv: 'LV',
        lt: 'LT',
        ga: 'IE',
        en: 'US',
        ja: 'JP',
        ko: 'KR',
        zh: 'CN',
        ar: 'SA',
        tr: 'TR',
        ru: 'RU',
      };
      const mapped = LANG_TO_COUNTRY[langMatch[1]];
      if (mapped) return mapped;
    }
  }

  return undefined;
}

export default async function ExplorePage() {
  const hdrs = await headers();
  const countryCode = detectCountry(hdrs);

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

          {/* Search bar — typeahead with Google-style dropdown */}
          <TypeaheadSearch />

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
              <div className="relative mx-auto w-56 sm:w-64">
                <div className="overflow-hidden rounded-[2rem] border-2 border-neutral-700 bg-neutral-900">
                  {/* biome-ignore lint/performance/noImgElement: decorative marketing image */}
                  <img
                    src="/screenshots/trip-detail-hero.png"
                    alt="MotoVault trip planning — Dolomites Loop route map"
                    width={1170}
                    height={2532}
                    className="block w-full"
                    loading="lazy"
                  />
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
                {TOP_ROUTES_SEO.map((route) => (
                  <li key={route.name}>
                    <a
                      href={route.href}
                      className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
                    >
                      {route.name}
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
                {TOP_REGIONS_SEO.map((region) => (
                  <li key={region.name}>
                    <a
                      href={region.href}
                      className="text-sm text-neutral-400 transition-colors hover:text-neutral-200"
                    >
                      {region.name}
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
