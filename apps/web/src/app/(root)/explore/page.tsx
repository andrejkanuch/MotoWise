import type { TripTemplatesQuery } from '@motovault/graphql';
import { TripTemplatesDocument } from '@motovault/graphql';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppPromo } from '@/components/explore/app-promo';
import { CountryLedger } from '@/components/explore/country-ledger';
import { EditorsLedger } from '@/components/explore/editors-ledger';
import { HeroBold } from '@/components/explore/hero-bold';
import { PopularLocal } from '@/components/explore/popular-local';
import { type PopularTrip, toPopularTrip } from '@/components/explore/popular-strip';
import { SkeletonRows } from '@/components/explore/primitives';
import { BASE_URL } from '@/lib/constants';
import { fetchCountries } from '@/lib/fetch-places';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';

type TripTemplateNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

/* ── Revalidation ─────────────────────────────────────────────── */

// Static: the visitor's country is resolved client-side (PopularLocal), so
// nothing in the render path reads request headers and the hour of ISR holds.
export const dynamic = 'force-static';
export const revalidate = 3600;

/** How many country strips the static page carries for the client to pick from. */
const LOCAL_STRIP_COUNTRIES = 12;

/* ── Metadata ─────────────────────────────────────────────────── */

const EXPLORE_OG_IMAGE = `${BASE_URL}/images/hero-explore-og.jpg`; // 1200×630, under 300 KB

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Motorcycle routes by country | MotoVault';
  const description =
    "Motorcycle routes by country and region, each with distance, climb and riding time. Editor's picks and the most-ridden routes.";

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${BASE_URL}/explore` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/explore`,
      siteName: 'MotoVault',
      type: 'website',
      images: [{ url: EXPLORE_OG_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [EXPLORE_OG_IMAGE],
    },
  };
}

/* ── Data fetching ───────────────────────────────────────────── */

/** `null` means the API did not answer; `[]` means it answered with nothing. */
async function fetchTrips(
  first: number,
  options: { country?: string } = {},
): Promise<TripTemplateNode[] | null> {
  try {
    const data = await gqlServerFetcher(TripTemplatesDocument, {
      filter: {
        ...(options.country ? { country: options.country } : {}),
      },
      first,
    });
    return data.tripTemplates.edges.map((e) => e.node);
  } catch {
    return null;
  }
}

async function fetchStaffPicks(): Promise<TripTemplateNode[] | null> {
  const trips = await fetchTrips(12);
  return trips?.filter((t) => t.isMotovaultPick).slice(0, 6) ?? null;
}

async function fetchTopTrips(limit = 4, country?: string): Promise<TripTemplateNode[] | null> {
  return fetchTrips(limit, { country });
}

/* ── API-down notice: name what happened and the next step ──────── */

function LoadFailedNotice() {
  return (
    <div className="xp-wrap xp-section-tight">
      <output className="xp-notice">
        Routes didn't load.{' '}
        <a href="/explore" className="mv-link">
          Try again
        </a>
      </output>
    </div>
  );
}

/* ── JSON-LD ──────────────────────────────────────────────────── */

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: BASE_URL,
  name: 'MotoVault',
};

/* ── Async sections (Suspense boundaries) ────────────────────── */

async function PopularSection({
  countries,
  countriesFailed,
}: {
  countries: Array<{ code: string; name: string }>;
  countriesFailed: boolean;
}) {
  const local = countries.slice(0, LOCAL_STRIP_COUNTRIES);
  const [world, ...perCountry] = await Promise.all([
    fetchTopTrips(4),
    ...local.map((c) => fetchTopTrips(4, c.code.toLowerCase())),
  ]);
  // The ledger already said the API is down; say it once.
  if (world === null) return countriesFailed ? null : <LoadFailedNotice />;

  const byCountry: Record<string, { name: string; trips: PopularTrip[] }> = {};
  local.forEach((c, i) => {
    const trips = perCountry[i];
    if (trips && trips.length > 0) {
      byCountry[c.code] = {
        name: COUNTRY_NAMES[c.code] ?? c.name,
        trips: trips.slice(0, 4).map(toPopularTrip),
      };
    }
  });

  return <PopularLocal world={world.slice(0, 4).map(toPopularTrip)} byCountry={byCountry} />;
}

async function EditorSection() {
  const picks = await fetchStaffPicks();
  if (!picks || picks.length === 0) return null;
  return <EditorsLedger picks={picks} />;
}

/* ── Skeletons ───────────────────────────────────────────────── */

function SectionSkeleton() {
  return (
    <div className="xp-wrap xp-section-tight">
      <span className="xp-skel" style={{ width: 240, height: 36 }} />
      <div style={{ marginTop: 24 }}>
        <SkeletonRows count={3} />
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default async function ExplorePage() {
  // Fetch countries for the ledger and stats. A failure is tracked, not
  // swallowed: an outage must not read as "no routes".
  let allCountries: Array<{ code: string; name: string; routeCount: number }> = [];
  let countriesFailed = false;
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
    countriesFailed = true;
  }

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

      {/* ===== HERO ===== */}
      <HeroBold
        totalRoutes={totalRoutes}
        totalCountries={totalCountries}
        countries={allCountries.map((c) => ({ code: c.code, label: c.name }))}
      />

      {countriesFailed && <LoadFailedNotice />}

      {/* ===== POPULAR IN YOUR COUNTRY (picked after mount) ===== */}
      <Suspense fallback={<SectionSkeleton />}>
        <PopularSection countries={allCountries} countriesFailed={countriesFailed} />
      </Suspense>

      {/* ===== EDITOR'S PICKS ===== */}
      <Suspense fallback={<SectionSkeleton />}>
        <EditorSection />
      </Suspense>

      {/* ===== COUNTRY LEDGER ===== */}
      <CountryLedger countries={allCountries} />

      {/* ===== APP PROMO ===== */}
      <AppPromo />
    </>
  );
}
