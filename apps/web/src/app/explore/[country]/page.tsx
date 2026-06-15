import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ResultsDesktop } from '@/components/explore/results-desktop';
import { ResultsMobile } from '@/components/explore/results-mobile';
import { BASE_URL, getHreflangMap } from '@/lib/constants';
import {
  fetchCountryBySlug,
  fetchRegionsByCountrySlug,
  fetchTripTemplatesByCountry,
} from '@/lib/fetch-places';

export const revalidate = 86400;

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ country: string }>;
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
      : `Motorcycle routes in ${country.name} are coming soon. Browse other countries on MotoVault.`;

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

  // Prevent thin-content pages from being indexed (soft 404 prevention).
  if (rc === 0) {
    return { ...base, robots: { index: false, follow: true } };
  }

  return base;
}

/* ── Map center heuristic ────────────────────────────────────── */

const COUNTRY_CENTERS: Record<string, [number, number]> = {
  US: [-98, 39],
  CA: [-106, 56],
  MX: [-102, 23],
  IT: [12.5, 42.5],
  FR: [2.2, 46.6],
  CH: [8.2, 46.8],
  ES: [-3.7, 40.4],
  AT: [13.3, 47.5],
  DE: [10.4, 51.1],
  PT: [-8.2, 39.4],
  GR: [23.7, 37.9],
  NO: [8.5, 60.5],
  GB: [-3.4, 55.4],
  JP: [138.3, 36.2],
  NZ: [174, -41],
  AU: [134, -25],
};

const COUNTRY_ZOOM: Record<string, number> = {
  US: 3.4,
  CA: 3,
  AU: 3,
};

/* ── Page ────────────────────────────────────────────────────── */

export default async function CountryPage({ params }: PageProps) {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) notFound();

  const [regions, trips] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug).catch(() => []),
    fetchTripTemplatesByCountry(country.countryCode, 50).catch(() => []),
  ]);

  const code = country.countryCode.toUpperCase();
  const center = COUNTRY_CENTERS[code] ?? [10, 46];
  const zoom = COUNTRY_ZOOM[code] ?? 5;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100dvh - 72px)',
      }}
    >
      {/* Desktop layout (hidden on mobile) */}
      <div
        className="hidden md:flex md:flex-col"
        // Definite height (not just min-height) so the inner grid bounds the
        // scrollable list and gives the map a real height instead of stretching
        // to the full list content. `flex: none` overrides `md:flex-1` (flex-basis
        // 0%, which would otherwise override `height`). Harmless on mobile — this
        // block is display:none there.
        style={{ minHeight: 0, height: 'calc(100dvh - 72px)', flex: 'none' }}
      >
        <Suspense>
          <ResultsDesktop
            allTrips={trips}
            country={country.name}
            countryCode={code}
            regionCount={regions.length}
            mapCenter={center}
            mapZoom={zoom}
          />
        </Suspense>
      </div>

      {/* Mobile layout (hidden on desktop) */}
      <div className="md:hidden">
        <Suspense>
          <ResultsMobile
            allTrips={trips}
            country={country.name}
            mapCenter={center}
            mapZoom={zoom}
          />
        </Suspense>
      </div>
    </div>
  );
}
