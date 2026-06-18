import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ResultsDesktop } from '@/components/explore/results-desktop';
import { ResultsMobile } from '@/components/explore/results-mobile';
import { BASE_URL, getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import {
  fetchPublishedTripSlugRefs,
  fetchRegionBySlug,
  fetchRegionsByCountrySlug,
  fetchTripTemplatesByRegion,
} from '@/lib/fetch-places';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import { reportSoftNotFound } from '@/lib/seo/soft-404';

// Statically prerendered (force-static) so the dynamic root layout
// (getLocale/getMessages read headers) doesn't drag this route into dynamic
// rendering — which is what served the not-found page with a 200 (soft 404).
// Static rendering lets notFound() emit a real 404, and ISR keeps it fresh.
export const dynamic = 'force-static';
export const revalidate = 86400; // 1 day — DB-sourced; invalidate on-demand via /api/revalidate

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ country: string; region: string }>;
}

/**
 * Resolve a region to its display names + published trips. The region page is
 * trip-derived (same source of truth as the sitemap and trip detail pages):
 * a `places` taxonomy row enriches the names when present, but its absence is
 * NOT a 404 as long as published trips exist for the country+region. This is
 * what previously broke — the sitemap advertises every region that has a trip,
 * but the page resolved only via `places`, which is missing most non-US regions
 * (e.g. all of Canada), so every such URL soft-404'd.
 */
async function resolveRegion(countrySlug: string, regionSlug: string) {
  const code = countrySlug.toUpperCase();
  const [places, allRegions, trips] = await Promise.all([
    fetchRegionBySlug(countrySlug, regionSlug).catch(() => null),
    fetchRegionsByCountrySlug(countrySlug).catch(() => []),
    fetchTripTemplatesByRegion(code, regionSlug, 50).catch(() => []),
  ]);

  // A region with neither a taxonomy row nor any trips is a genuine 404.
  if (!places && trips.length === 0) return null;

  return {
    code,
    trips,
    regionCount: allRegions.length,
    countryName: places?.country.name ?? countryDisplayName(countrySlug),
    regionName: places?.region.name ?? regionDisplayName(countrySlug, regionSlug),
  };
}

/** Prebuild every country/region that has a published trip — matches the sitemap. */
export async function generateStaticParams(): Promise<{ country: string; region: string }[]> {
  const refs = await fetchPublishedTripSlugRefs().catch(() => []);
  const seen = new Set<string>();
  const params: { country: string; region: string }[] = [];
  for (const ref of refs) {
    if (!ref.regionCode) continue;
    const country = ref.countryCode.toLowerCase();
    const region = ref.regionCode.toLowerCase();
    const key = `${country}/${region}`;
    if (seen.has(key)) continue;
    seen.add(key);
    params.push({ country, region });
  }
  return params;
}

/* ── Metadata ────────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: countrySlug, region: regionSlug } = await params;
  const result = await resolveRegion(countrySlug, regionSlug);
  if (!result) return {};

  const { countryName, regionName } = result;
  const title = `Motorcycle Routes in ${regionName}, ${countryName}`;
  const rc = result.trips.length;
  const description =
    rc > 0
      ? `Explore ${rc} motorcycle route${rc === 1 ? '' : 's'} in ${regionName}, ${countryName}. Twisty roads, scenic passes, and rides rated by the community.`
      : `Motorcycle routes in ${regionName}, ${countryName} are coming soon. Browse nearby regions on MotoVault.`;

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
  const result = await resolveRegion(countrySlug, regionSlug);
  if (!result) {
    reportSoftNotFound('explore-region', { country: countrySlug, region: regionSlug });
    notFound();
  }

  const { code, trips, regionCount, countryName, regionName } = result;

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
            country={countryName}
            countryCode={code}
            region={regionName}
            regionCount={regionCount}
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
            country={countryName}
            region={regionName}
            mapCenter={center}
            mapZoom={7}
          />
        </Suspense>
      </div>
    </div>
  );
}
