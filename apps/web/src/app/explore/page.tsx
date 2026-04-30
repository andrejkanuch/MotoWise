import type { TripTemplatesQuery } from '@motovault/graphql';
import { TripTemplatesDocument } from '@motovault/graphql';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import { Suspense } from 'react';
import { ExploreSearchBar } from '@/components/explore-search-bar';
import { SaveRouteButton } from '@/components/save-route-button';
import { BASE_URL } from '@/lib/constants';
import { fetchCountries } from '@/lib/fetch-places';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';

type TripTemplateNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

/* ── Constants ────────────────────────────────────────────────── */

// Country grid is now dynamic — fetched from browseCountries API, sorted by routeCount.

const TOP_ROUTES_SEO = [
  { name: 'Pacific Coast Highway', href: '/trips/us/ca/pacific-coast-highway' },
  { name: 'Transfagarasan', href: '/trips/ro/ag/transfgran' },
  { name: 'Stelvio Pass', href: '/trips/it/taa/stelvio-pass' },
  { name: 'Grossglockner', href: '/trips/at/k/grossglockner-hochalpenstrae' },
  { name: 'Tail of the Dragon', href: '/trips/us/tn/tail-of-the-dragon' },
  { name: 'Col du Galibier', href: '/trips/fr/paca/col-du-galibier' },
  { name: 'Trollstigen', href: '/trips/no/mr/trollstigen' },
  { name: 'Sa Calobra', href: '/trips/es/ib/sa-calobra' },
  { name: 'Furka Pass', href: '/trips/ch/vs/furka-pass' },
  { name: 'Grimsel Pass', href: '/trips/ch/vs/grimsel-pass' },
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

/* ── Data (GraphQL API — public tripTemplates) ─────────────────── */

async function fetchTrips(
  first: number,
  options: { country?: string } = {},
): Promise<TripTemplateNode[]> {
  try {
    const data = await gqlServerFetcher(TripTemplatesDocument, {
      filter: {
        ...(options.country ? { country: options.country } : {}),
      },
      first,
    });
    return data.tripTemplates.edges.map((e) => e.node);
  } catch {
    return [];
  }
}

async function fetchStaffPicks(): Promise<TripTemplateNode[]> {
  const trips = await fetchTrips(12);
  return trips.filter((t) => t.isMotovaultPick).slice(0, 6);
}

async function fetchTopTrips(limit = 8, country?: string): Promise<TripTemplateNode[]> {
  return fetchTrips(limit, { country });
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

function getDifficultyDisplay(difficulty: string): { label: string; cls: string } {
  switch (difficulty) {
    case 'expert':
      return { label: 'Expert', cls: 'epic' };
    case 'challenging':
      return { label: 'Hard', cls: 'hard' };
    case 'moderate':
      return { label: 'Moderate', cls: 'med' };
    default:
      return { label: 'Easy', cls: 'easy' };
  }
}

function estimateTime(distanceM: number, surfaceType?: string | null): string {
  const avgSpeed = surfaceType === 'off-road' ? 25 : surfaceType === 'mixed' ? 40 : 60;
  const hours = distanceM / 1000 / avgSpeed;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function tripHref(trip: TripTemplateNode): string {
  if (trip.slug && trip.countryCode && trip.regionCode) {
    return `/trips/${trip.countryCode}/${trip.regionCode}/${trip.slug}`;
  }
  return `/trips/${trip.id}`;
}

/* ── Trip Card ──────────────────────────────────────────────── */

const ROUTE_IMAGES = [
  '/images/route-card-placeholder.jpg',
  '/images/route-coastal.jpg',
  '/images/route-forest.jpg',
];

function TripCard({
  trip,
  priority = false,
  featured = false,
}: {
  trip: TripTemplateNode;
  priority?: boolean;
  featured?: boolean;
}) {
  const difficulty = getDifficultyDisplay(trip.difficulty);
  const imageIndex = trip.id.charCodeAt(0) % ROUTE_IMAGES.length;
  const imageSrc = ROUTE_IMAGES[imageIndex];

  return (
    <a
      href={tripHref(trip)}
      style={{
        position: 'relative',
        display: 'block',
        aspectRatio: featured ? '4/5' : '4/3',
        borderRadius: 'var(--mv-radius)',
        overflow: 'hidden',
        background: 'var(--mv-surface)',
        cursor: 'pointer',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform 0.5s var(--mv-ease)',
      }}
      className="group"
    >
      {/* Background image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transition: 'transform 0.8s var(--mv-ease-expo), filter 0.4s',
          filter: 'saturate(0.9) brightness(0.6)',
        }}
        className="group-hover:scale-[1.06] group-hover:brightness-[0.72] group-hover:saturate-100"
      >
        <Image
          src={imageSrc}
          alt={trip.title ?? 'Route'}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          priority={priority}
        />
      </div>

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, oklch(0.08 0.008 55 / 0.5) 0%, transparent 30%, transparent 45%, oklch(0.08 0.008 55 / 0.95) 100%)',
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* Save button */}
      <span style={{ position: 'absolute', right: 20, top: 20, zIndex: 3 }}>
        <SaveRouteButton routeId={trip.id} />
      </span>

      {/* Editor's Pick badge */}
      {trip.isMotovaultPick && (
        <span
          style={{
            position: 'absolute',
            top: 22,
            left: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px 5px 5px',
            background: 'oklch(0.1 0.008 55 / 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--mv-line)',
            borderRadius: 999,
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            color: 'var(--mv-warm-400)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            zIndex: 2,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <title>Star</title>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
          </svg>
          Editor&apos;s Pick
        </span>
      )}

      {/* Country badge */}
      {trip.countryCode && (
        <span
          style={{
            position: 'absolute',
            top: 22,
            left: trip.isMotovaultPick ? 'auto' : 20,
            right: trip.isMotovaultPick ? 'auto' : 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px 5px 5px',
            background: 'oklch(0.1 0.008 55 / 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--mv-line)',
            borderRadius: 999,
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            color: 'var(--mv-ink-2)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            zIndex: 2,
            ...(trip.isMotovaultPick ? { top: 60, left: 20 } : {}),
          }}
        >
          {COUNTRY_NAMES[trip.countryCode] ?? trip.countryCode}
        </span>
      )}

      {/* Body content */}
      <div
        style={{
          position: 'absolute',
          left: 24,
          right: 24,
          bottom: 24,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: featured ? 26 : 20,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.08,
          }}
        >
          {trip.title ?? 'Unnamed Route'}
        </div>

        {/* Stats row */}
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap' as const,
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            color: 'var(--mv-ink-2)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
          }}
        >
          {trip.distanceM != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--mv-warm-500)',
                }}
              />
              {formatDistance(trip.distanceM)}
            </span>
          )}
          {trip.elevationGainM != null && trip.elevationGainM > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--mv-warm-500)',
                }}
              />
              {trip.elevationGainM.toLocaleString()}m elev
            </span>
          )}
          {trip.distanceM != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--mv-warm-500)',
                }}
              />
              {estimateTime(trip.distanceM, trip.surfaceType)}
            </span>
          )}
          {trip.averageRating != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--mv-warm-500)',
                }}
              />
              {trip.averageRating.toFixed(1)} rating
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--mv-warm-500)',
              }}
            />
            {difficulty.label}
          </span>
        </div>
      </div>
    </a>
  );
}

/* ── Skeleton ────────────────────────────────────────────────── */

function SectionSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className={cols === 3 ? 'mv-grid-3' : 'mv-grid-4'} style={{ gap: 20 }}>
      {SECTION_SKELETON_KEYS.slice(0, cols).map((slot) => (
        <div
          key={slot}
          style={{
            aspectRatio: '4/3',
            borderRadius: 'var(--mv-radius)',
            background: 'var(--mv-surface)',
            border: '1px solid var(--mv-line)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      ))}
    </div>
  );
}

/* ── Async sections ──────────────────────────────────────────── */

async function NearYouSection({ countryCode }: { countryCode: string | undefined }) {
  const trips = await fetchTopTrips(4, countryCode);
  if (trips.length === 0) return null;
  const countryName = countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode) : null;

  return (
    <section style={{ padding: '90px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 40,
          marginBottom: 40,
        }}
      >
        <div>
          <div className="mv-section-meta">
            {countryName ? `Routes in ${countryName}` : 'Popular routes'}
          </div>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              marginTop: 10,
            }}
          >
            {countryName ? (
              <>
                Routes near{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {countryName}.
                </span>
              </>
            ) : (
              <>
                Trending{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  this week.
                </span>
              </>
            )}
          </h2>
        </div>
        <a
          href="/explore"
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 11,
            color: 'var(--mv-ink-2)',
            textDecoration: 'none',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 999,
            border: '1px solid var(--mv-line)',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          View all &rarr;
        </a>
      </div>

      <div className="mv-grid-4" style={{ gap: 20 }}>
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </section>
  );
}

async function StaffPicksSection() {
  const picks = await fetchStaffPicks();
  if (picks.length === 0) return null;

  return (
    <section style={{ padding: '90px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 40,
          marginBottom: 40,
        }}
      >
        <div>
          <div className="mv-section-meta">The bucket list</div>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              marginTop: 10,
            }}
          >
            Editor&apos;s picks,{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              ridden by thousands.
            </span>
          </h2>
          <p
            style={{
              color: 'var(--mv-ink-3)',
              fontSize: 14,
              maxWidth: 360,
              lineHeight: 1.55,
              marginTop: 12,
            }}
          >
            The greatest hits, with rider notes on best season, corners to watch, and where to stop
            for coffee.
          </p>
        </div>
      </div>

      <div className="mv-grid-3" style={{ gap: 20 }}>
        {picks.map((trip) => (
          <TripCard key={trip.id} trip={trip} priority featured />
        ))}
      </div>
    </section>
  );
}

async function TopTripsSection() {
  const trips = await fetchTopTrips(8);
  if (trips.length === 0) return null;

  return (
    <section style={{ padding: '90px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 40,
          marginBottom: 40,
        }}
      >
        <div>
          <div className="mv-section-meta">All routes</div>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              marginTop: 10,
            }}
          >
            Browse{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              the atlas.
            </span>
          </h2>
          <p
            style={{
              color: 'var(--mv-ink-3)',
              fontSize: 14,
              maxWidth: 360,
              lineHeight: 1.55,
              marginTop: 12,
            }}
          >
            Filter, sort, scan. Click any route for the full map, elevation profile and rider notes.
          </p>
        </div>
      </div>

      <div className="mv-grid-4" style={{ gap: 20 }}>
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </section>
  );
}

/* ── JSON-LD ──────────────────────────────────────────────────── */

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: BASE_URL,
  name: 'MotoVault',
};

/* ── Country detection ──────────────────────────────────────── */

function detectCountry(hdrs: Headers): string | undefined {
  const cf = hdrs.get('cf-ipcountry');
  if (cf && cf !== 'XX' && cf !== 'T1') return cf.toUpperCase();

  const vercel = hdrs.get('x-vercel-ip-country');
  if (vercel) return vercel.toUpperCase();

  const custom = hdrs.get('x-country-code');
  if (custom) return custom.toUpperCase();

  const acceptLang = hdrs.get('accept-language');
  if (acceptLang) {
    const regionMatch = acceptLang.match(/[a-z]{2}-([A-Z]{2})/);
    if (regionMatch) return regionMatch[1];

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

/* ── Page ─────────────────────────────────────────────────────── */

export default async function ExplorePage() {
  const hdrs = await headers();
  const countryCode = detectCountry(hdrs);

  // Fetch countries dynamically — sorted by route count, top 12 for the grid
  let allCountries: Array<{ code: string; name: string; routeCount: number }> = [];
  try {
    const places = await fetchCountries();
    allCountries = places
      .filter((p) => p.routeCount > 0)
      .sort((a, b) => b.routeCount - a.routeCount)
      .map((p) => ({
        code: p.countryCode.toUpperCase(),
        name: p.name,
        routeCount: p.routeCount,
      }));
  } catch {
    // fallback: empty grid
  }
  const topCountries = allCountries.slice(0, 12);
  const totalCountries = allCountries.length;
  const totalRoutes = allCountries.reduce((sum, c) => sum + c.routeCount, 0);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* ===== SEARCH HERO ===== */}
      <section
        style={{
          position: 'relative',
          padding: '140px 40px 56px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="mv-section-meta" style={{ margin: 0 }}>
            Explore &middot; rider-curated atlas
          </div>
        </div>

        <h1
          style={{
            fontSize: 'clamp(44px, 6.5vw, 88px)',
            fontWeight: 500,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            margin: '18px 0 0',
            maxWidth: 1100,
          }}
        >
          Where are you{' '}
          <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
            riding next?
          </span>
        </h1>

        <p
          style={{
            marginTop: 20,
            color: 'var(--mv-ink-2)',
            fontSize: 17,
            maxWidth: 680,
            lineHeight: 1.5,
            letterSpacing: '-0.005em',
          }}
        >
          Search {totalRoutes.toLocaleString()}+ routes from riders in {totalCountries} countries.
          Pick a pass, a coastline, a country — or just an evening escape after work.
        </p>

        <Suspense>
          <ExploreSearchBar
            countries={allCountries.map((c) => ({ code: c.code, label: c.name }))}
          />
        </Suspense>
      </section>

      {/* ===== STATS BAR ===== */}
      <div
        style={{
          maxWidth: 'var(--mv-container)',
          margin: '40px auto 0',
          padding: '0 40px',
        }}
      >
        <div
          className="mv-grid-3"
          style={{
            gap: 2,
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          {[
            { value: totalRoutes.toLocaleString(), serif: '+', label: 'Routes shared' },
            { value: String(totalCountries), serif: '', label: 'Countries represented' },
            { value: String(topCountries.length), serif: '', label: 'Featured countries' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: 'oklch(0.13 0.01 55)',
                padding: '24px 28px',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {stat.value}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {stat.serif}
                </span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 10,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== COUNTRIES ===== */}
      <section style={{ padding: '90px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 40,
            marginBottom: 40,
          }}
        >
          <div>
            <div className="mv-section-meta">Browse by country</div>
            <h2
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                marginTop: 10,
              }}
            >
              Where{' '}
              <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                riders ride.
              </span>
            </h2>
            <p
              style={{
                color: 'var(--mv-ink-3)',
                fontSize: 14,
                maxWidth: 360,
                lineHeight: 1.55,
                marginTop: 12,
              }}
            >
              The twelve most-explored countries on MotoVault this season. Tap in for routes, passes
              and rider notes.
            </p>
          </div>
          <a
            href="/explore"
            style={{
              fontFamily: 'var(--font-geist-mono, monospace)',
              fontSize: 11,
              color: 'var(--mv-ink-2)',
              textDecoration: 'none',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 999,
              border: '1px solid var(--mv-line)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            All {totalCountries} countries &rarr;
          </a>
        </div>

        <div className="mv-grid-4" style={{ gap: 14 }}>
          {topCountries.map(({ code, name, routeCount }) => (
            <a
              key={code}
              href={`/explore/${code.toLowerCase()}`}
              className="group"
              style={{
                position: 'relative',
                aspectRatio: '1/1.1',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
                cursor: 'pointer',
                transition: 'transform 0.4s var(--mv-ease), border-color 0.3s',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {/* Dark background */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(145deg, oklch(0.14 0.012 55), oklch(0.09 0.008 55))',
                }}
              />
              {/* Bottom gradient */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, transparent 40%, oklch(0.08 0.008 55 / 0.96) 100%)',
                  zIndex: 1,
                }}
              />
              {/* Content */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  zIndex: 2,
                }}
              >
                {/* Country code badge instead of emoji (reliable cross-platform) */}
                <span
                  style={{
                    alignSelf: 'flex-start',
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.1em',
                    background: 'var(--mv-surface)',
                    border: '1px solid var(--mv-line)',
                    borderRadius: 6,
                    padding: '4px 8px',
                  }}
                >
                  {code}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily: 'var(--font-geist-mono, monospace)',
                      fontSize: 10,
                      color: 'var(--mv-ink-2)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: 'var(--mv-warm-500)',
                      }}
                    />
                    {routeCount} routes
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ===== EDITOR'S PICKS ===== */}
      <Suspense fallback={<SectionSkeleton cols={3} />}>
        <StaffPicksSection />
      </Suspense>

      {/* ===== NEAR YOU / POPULAR ===== */}
      <Suspense fallback={<SectionSkeleton cols={4} />}>
        <NearYouSection countryCode={countryCode} />
      </Suspense>

      {/* ===== APP PROMOTION ===== */}
      <div
        style={{
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
          padding: '0 40px 90px',
        }}
      >
        <div
          className="mv-grid-2"
          style={{
            position: 'relative',
            borderRadius: 24,
            overflow: 'hidden',
            background: 'linear-gradient(145deg, oklch(0.14 0.012 55), oklch(0.09 0.008 55))',
            border: '1px solid var(--mv-line)',
            padding: 40,
            gap: 40,
          }}
        >
          <div>
            <div className="mv-section-meta" style={{ marginBottom: 16 }}>
              MotoVault App
            </div>
            <h2
              style={{
                fontSize: 'clamp(28px, 3.5vw, 40px)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}
            >
              Track every ride,{' '}
              <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                share every road.
              </span>
            </h2>
            <p
              style={{
                color: 'var(--mv-ink-2)',
                fontSize: 14,
                lineHeight: 1.6,
                marginTop: 16,
                maxWidth: 360,
              }}
            >
              Record rides with live GPS tracking, log expenses, diagnose issues with AI, and
              discover routes shared by riders worldwide.
            </p>
            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
              <a
                href="https://apps.apple.com/us/app/motovault/id6760291360"
                className="mv-btn mv-btn-primary"
              >
                <span>App Store</span>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.motovault.app"
                className="mv-btn mv-btn-ghost"
              >
                Google Play
              </a>
            </div>
          </div>
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 280,
                aspectRatio: '9/19.5',
                borderRadius: 40,
                background: '#080808',
                padding: 8,
                boxShadow: '0 50px 100px -20px oklch(0 0 0 / 0.7)',
              }}
            >
              {/* Notch */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 100,
                  height: 26,
                  background: '#000',
                  borderRadius: 999,
                  zIndex: 3,
                }}
              />
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 32,
                  overflow: 'hidden',
                  background: '#111',
                  position: 'relative',
                }}
              >
                {/* biome-ignore lint/performance/noImgElement: decorative marketing image */}
                <img
                  src="/screenshots/trip-detail-hero.png"
                  alt="MotoVault trip planning — Dolomites Loop route map"
                  width={1170}
                  height={2532}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                  }}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== TOP ROUTES ===== */}
      <Suspense fallback={<SectionSkeleton cols={4} />}>
        <TopTripsSection />
      </Suspense>

      {/* ===== CURATED THEMES ===== */}
      <section style={{ padding: '90px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 40,
            marginBottom: 40,
          }}
        >
          <div>
            <div className="mv-section-meta">Curated collections</div>
            <h2
              style={{
                fontSize: 'clamp(32px, 4vw, 48px)',
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                marginTop: 10,
              }}
            >
              Ride by{' '}
              <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                theme.
              </span>
            </h2>
          </div>
        </div>

        <div className="mv-grid-3" style={{ gap: 16 }}>
          {[
            {
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <title>Mountain</title>
                  <path d="M3 18l6-12 4 8 3-4 5 8z" />
                </svg>
              ),
              title: 'Mountain Passes',
              body: 'Hairpins, altitude, thin air. The passes that make Europe and the Americas a motorcycle paradise.',
              count: '2,340 routes',
            },
            {
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <title>Coast</title>
                  <path d="M2 12c2-3 5-5 10-5s8 2 10 5c-2 3-5 5-10 5S4 15 2 12z" />
                </svg>
              ),
              title: 'Coastal Roads',
              body: 'Salt air, ocean views, endless curves. Ride the line between land and sea.',
              count: '1,890 routes',
            },
            {
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <title>Clock</title>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              ),
              title: 'Weekend Escapes',
              body: 'Quick getaways you can fit into a Saturday. Close to cities, far from monotony.',
              count: '3,120 routes',
            },
          ].map((theme) => (
            <a
              key={theme.title}
              href={`/explore?q=${encodeURIComponent(theme.title)}`}
              style={{
                padding: '28px 28px 26px',
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
                borderRadius: 18,
                cursor: 'pointer',
                transition: 'all 0.3s',
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 220,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'oklch(0.76 0.18 60 / 0.12)',
                  border: '1px solid oklch(0.76 0.18 60 / 0.3)',
                  color: 'var(--mv-warm-400)',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: 20,
                }}
              >
                {theme.icon}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                }}
              >
                {theme.title}
              </div>
              <div
                style={{
                  color: 'var(--mv-ink-3)',
                  fontSize: 13,
                  lineHeight: 1.55,
                  marginTop: 8,
                  flex: 1,
                }}
              >
                {theme.body}
              </div>
              <div
                style={{
                  marginTop: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 18,
                  borderTop: '1px solid var(--mv-line)',
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 10,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                }}
              >
                <span>{theme.count}</span>
                <span style={{ color: 'var(--mv-warm-400)' }}>Explore &rarr;</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ===== SEO FOOTER — "Ride anywhere" ===== */}
      <section
        style={{
          padding: '0 40px 120px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            borderTop: '1px solid var(--mv-line)',
            paddingTop: 60,
          }}
        >
          <div className="mv-section-meta">Ride anywhere</div>
          <h2
            style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              marginTop: 10,
              marginBottom: 40,
            }}
          >
            The complete{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              atlas.
            </span>
          </h2>
          <div className="mv-grid-3" style={{ gap: 40 }}>
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 11,
                  color: 'var(--mv-ink-4)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase' as const,
                  marginBottom: 18,
                }}
              >
                Top routes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {TOP_ROUTES_SEO.map((route) => (
                  <a
                    key={route.name}
                    href={route.href}
                    style={{
                      color: 'var(--mv-ink-2)',
                      textDecoration: 'none',
                      fontSize: 14,
                      padding: '6px 0',
                      transition: 'color 0.2s, transform 0.2s',
                      letterSpacing: '-0.005em',
                      display: 'block',
                    }}
                  >
                    {route.name}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 11,
                  color: 'var(--mv-ink-4)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase' as const,
                  marginBottom: 18,
                }}
              >
                Top regions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {TOP_REGIONS_SEO.map((region) => (
                  <a
                    key={region.name}
                    href={region.href}
                    style={{
                      color: 'var(--mv-ink-2)',
                      textDecoration: 'none',
                      fontSize: 14,
                      padding: '6px 0',
                      transition: 'color 0.2s, transform 0.2s',
                      letterSpacing: '-0.005em',
                      display: 'block',
                    }}
                  >
                    {region.name}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h3
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 11,
                  color: 'var(--mv-ink-4)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase' as const,
                  marginBottom: 18,
                }}
              >
                Top countries
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topCountries.map(({ code, name }) => (
                  <a
                    key={code}
                    href={`/explore/${code.toLowerCase()}`}
                    style={{
                      color: 'var(--mv-ink-2)',
                      textDecoration: 'none',
                      fontSize: 14,
                      padding: '6px 0',
                      transition: 'color 0.2s, transform 0.2s',
                      letterSpacing: '-0.005em',
                      display: 'block',
                    }}
                  >
                    {name}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
