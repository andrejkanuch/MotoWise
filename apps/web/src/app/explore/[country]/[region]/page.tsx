import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ResultsDesktop } from '@/components/explore/results-desktop';
import { ResultsMobile } from '@/components/explore/results-mobile';
import { BASE_URL, getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import {
  fetchRegionBySlug,
  fetchRegionsByCountrySlug,
  fetchTripTemplatesByRegion,
} from '@/lib/fetch-places';

export const revalidate = 3600;

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ country: string; region: string }>;
}

/* ── Metadata ────────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: countrySlug, region: regionSlug } = await params;
  const result = await fetchRegionBySlug(countrySlug, regionSlug);
  if (!result) return {};

  const { country, region } = result;
  const title = `Motorcycle Routes in ${region.name}, ${country.name}`;
  const rc = region.routeCount;
  const description =
    rc > 0
      ? `Explore ${rc} motorcycle route${rc === 1 ? '' : 's'} in ${region.name}, ${country.name}. Twisty roads, scenic passes, and rides rated by the community.`
      : `Motorcycle routes in ${region.name}, ${country.name} are coming soon. Browse nearby regions on MotoVault.`;

  const canonical = getCanonicalUrl('en', `/explore/${countrySlug}/${regionSlug}`);
  const base: Metadata = {
    title: { absolute: `${title} | MotoVault` },
    description,
    alternates: {
      canonical,
      languages: getHreflangMap(`/explore/${countrySlug}/${regionSlug}`),
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

/* ── Page ────────────────────────────────────────────────────── */

export default async function RegionPage({ params }: PageProps) {
  const { country: countrySlug, region: regionSlug } = await params;
  const result = await fetchRegionBySlug(countrySlug, regionSlug);
  if (!result) notFound();

  const { country, region } = result;
  const code = country.countryCode.toUpperCase();

  const [allRegions, trips] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug).catch(() => []),
    fetchTripTemplatesByRegion(code, regionSlug, 50).catch(() => []),
  ]);

  // Compute center from trip coordinates, fallback to country center
  let center: [number, number] = [10, 46];
  const tripsWithCoords = trips.filter((t) => t.startLat != null && t.startLng != null);
  if (tripsWithCoords.length > 0) {
    const avgLng =
      tripsWithCoords.reduce((s, t) => s + (t.startLng ?? 0), 0) / tripsWithCoords.length;
    const avgLat =
      tripsWithCoords.reduce((s, t) => s + (t.startLat ?? 0), 0) / tripsWithCoords.length;
    center = [avgLng, avgLat];
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 'calc(100dvh - 72px)',
      }}
    >
      {/* Desktop */}
      <div className="hidden md:flex md:flex-col md:flex-1" style={{ minHeight: 0 }}>
        <Suspense>
          <ResultsDesktop
            allTrips={trips}
            country={country.name}
            countryCode={code}
            region={region.name}
            regionCount={allRegions.length}
            mapCenter={center}
            mapZoom={7}
          />
        </Suspense>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <Suspense>
          <ResultsMobile
            allTrips={trips}
            country={country.name}
            region={region.name}
            mapCenter={center}
            mapZoom={7}
          />
        </Suspense>
      </div>
    </div>
  );
}
