import type { TripTemplatesQuery } from '@motovault/graphql';
import { TripTemplatesDocument } from '@motovault/graphql';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { AppPromo } from '@/components/explore/app-promo';
import { CountryLedger } from '@/components/explore/country-ledger';
import { EditorsLedger } from '@/components/explore/editors-ledger';
import { HeroBold } from '@/components/explore/hero-bold';
import { PopularStrip } from '@/components/explore/popular-strip';
import { SkeletonCard } from '@/components/explore/primitives';
import { BASE_URL } from '@/lib/constants';
import { fetchCountries } from '@/lib/fetch-places';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';

type TripTemplateNode = TripTemplatesQuery['tripTemplates']['edges'][number]['node'];

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

/* ── Data fetching ───────────────────────────────────────────── */

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

async function fetchTopTrips(limit = 4, country?: string): Promise<TripTemplateNode[]> {
  return fetchTrips(limit, { country });
}

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

/* ── JSON-LD ──────────────────────────────────────────────────── */

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  url: BASE_URL,
  name: 'MotoVault',
};

/* ── Async sections (Suspense boundaries) ────────────────────── */

async function PopularSection({ countryCode }: { countryCode: string | undefined }) {
  const trips = await fetchTopTrips(4, countryCode);
  if (trips.length === 0) return null;
  const countryName = countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode) : 'the world';
  return <PopularStrip trips={trips} countryName={countryName} />;
}

async function EditorSection() {
  const picks = await fetchStaffPicks();
  if (picks.length === 0) return null;
  return <EditorsLedger picks={picks} />;
}

/* ── Skeletons ───────────────────────────────────────────────── */

function SectionSkeleton() {
  return (
    <div style={{ padding: '90px 40px', maxWidth: 1320, margin: '0 auto' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export default async function ExplorePage() {
  const hdrs = await headers();
  const countryCode = detectCountry(hdrs);

  // Fetch countries for the ledger and stats
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
    // fallback: empty
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

      {/* ===== POPULAR IN YOUR COUNTRY ===== */}
      <Suspense fallback={<SectionSkeleton />}>
        <PopularSection countryCode={countryCode} />
      </Suspense>

      {/* ===== EDITOR'S PICKS ===== */}
      <Suspense fallback={<SectionSkeleton />}>
        <EditorSection />
      </Suspense>

      {/* ===== COUNTRY LEDGER ===== */}
      <CountryLedger countries={allCountries} />

      {/* ===== APP PROMO ===== */}
      <div style={{ padding: '120px 40px 0', maxWidth: 1320, margin: '0 auto' }}>
        <AppPromo />
      </div>

      <div style={{ height: 80 }} />
    </>
  );
}
