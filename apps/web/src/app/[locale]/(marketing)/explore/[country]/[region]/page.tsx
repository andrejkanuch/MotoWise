import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { RouteCard } from '@/components/marketing/route-card';
import { BASE_URL } from '@/lib/constants';
import {
  fetchPublishedTripSlugRefs,
  fetchRegionBySlug,
  fetchRoutesByRegion,
} from '@/lib/fetch-places';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import { relativeTrip } from '@/lib/seo/canonical';
import { buildBreadcrumbList, buildGraph, buildItemList, buildWebPage } from '@/lib/seo/schema';
import { reportSoftNotFound } from '@/lib/seo/soft-404';

// Prerender + `dynamicParams = false` so an unknown country/region is a REAL 404 from the
// router. As a dynamic route it streamed its shell before the page resolved, and
// `notFound()` after streaming starts can only return 200 (Next.js: not-found
// returns 404 for non-streamed responses, 200 for streamed ones) — Sentry MOTOVAULT-WEB-P.
// The `[locale]` layout already generates all 8 locale params, so returning just
// the geo segment(s) here yields the full cartesian product.
export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = 86400; // 1 day — DB-sourced; invalidate on-demand via /api/revalidate

/** Every country/region pair that has a published trip — matches the sitemap. */
export async function generateStaticParams(): Promise<{ country: string; region: string }[]> {
  // Not `.catch(() => [])` — see the country route above.
  const refs = await fetchPublishedTripSlugRefs();
  const seen = new Map<string, { country: string; region: string }>();
  for (const r of refs) {
    if (!r.regionCode) continue;
    const country = r.countryCode.toLowerCase();
    const region = r.regionCode.toLowerCase();
    seen.set(`${country}/${region}`, { country, region });
  }
  return [...seen.values()];
}

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ locale: string; country: string; region: string }>;
}

/**
 * Trip-derived region resolution (mirrors the non-locale explore page): names
 * come from the `places` taxonomy when a row exists, otherwise from geo-names.
 * A region is only a 404 when it has neither a taxonomy row nor any routes —
 * so sitemap-advertised regions without a `places` row (most non-US regions)
 * resolve instead of soft-404ing.
 */
async function resolveRegion(countrySlug: string, regionSlug: string) {
  const code = countrySlug.toUpperCase();
  const [places, routes] = await Promise.all([
    fetchRegionBySlug(countrySlug, regionSlug).catch(() => null),
    fetchRoutesByRegion(code, regionSlug, 50).catch(() => []),
  ]);
  if (!places && routes.length === 0) return null;
  return {
    routes,
    countryName: places?.country.name ?? countryDisplayName(countrySlug),
    regionName: places?.region.name ?? regionDisplayName(countrySlug, regionSlug),
    routeCount: places?.region.routeCount ?? routes.length,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, country: countrySlug, region: regionSlug } = await params;
  setRequestLocale(locale);

  const result = await resolveRegion(countrySlug, regionSlug);
  if (!result) return {};

  const { countryName, regionName, routeCount } = result;
  const title = `Motorcycle Routes in ${regionName}, ${countryName}`;
  const description =
    routeCount > 0
      ? `Explore ${routeCount} motorcycle route${routeCount === 1 ? '' : 's'} in ${regionName}, ${countryName}. Find the best twisty roads, scenic passes, and rides rated by the community.`
      : `Motorcycle routes in ${regionName}, ${countryName} are coming soon. Browse nearby regions on MotoVault.`;

  // Explore content is not translated — always canonical to the non-localized version
  // to prevent Google from seeing locale variants as duplicates.
  const canonical = `${BASE_URL}/explore/${countrySlug}/${regionSlug}`;

  const base: Metadata = {
    title: { absolute: `${title} | MotoVault` },
    description,
    alternates: {
      canonical,
      languages: { 'x-default': canonical },
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

  if (routeCount === 0) {
    return { ...base, robots: { index: false, follow: true } };
  }

  return base;
}

export default async function RegionPage({ params }: PageProps) {
  const { locale, country: countrySlug, region: regionSlug } = await params;
  setRequestLocale(locale);

  const result = await resolveRegion(countrySlug, regionSlug);
  if (!result) {
    reportSoftNotFound('explore-region', { locale, country: countrySlug, region: regionSlug });
    notFound();
  }

  const { routes, countryName, regionName, routeCount } = result;

  const title = `Motorcycle Routes in ${regionName}, ${countryName}`;
  const description = `Explore ${routeCount} motorcycle routes in ${regionName}, ${countryName}.`;
  // Explore content is not translated — the page canonicalizes to the unprefixed
  // English URL (see generateMetadata), so JSON-LD/breadcrumb URLs use the same
  // EN URL to avoid mixed canonical signals in Search Console.
  const canonical = `${BASE_URL}/explore/${countrySlug}/${regionSlug}`;

  // Enumerate the routes for an ItemList (complements the CollectionPage below).
  const routeItems = routes
    .map((route) =>
      route.slug && route.regionSlug && route.countryCode
        ? {
            name: route.displayName ?? route.name ?? 'Motorcycle route',
            // Trip detail canonical lives at the non-localized /trips/... route.
            // There is no /explore/{country}/{region}/{slug} page. relativeTrip()
            // lowercases all segments to match the trip page's self-canonical.
            url: `${BASE_URL}${relativeTrip(route.countryCode, route.regionSlug, route.slug)}`,
          }
        : null,
    )
    .filter((entry): entry is { name: string; url: string } => entry !== null);

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: title,
      description,
      locale,
      pageKey: `/explore/${countrySlug}/${regionSlug}`,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: BASE_URL },
        { name: 'Explore', url: `${BASE_URL}/explore` },
        { name: countryName, url: `${BASE_URL}/explore/${countrySlug}` },
        { name: regionName, url: canonical },
      ],
      locale,
      `/explore/${countrySlug}/${regionSlug}`,
    ),
    // CollectionPage for rich results
    {
      '@type': 'CollectionPage',
      '@id': `${BASE_URL}/#/explore/${countrySlug}/${regionSlug}/collection`,
      name: title,
      description,
      url: canonical,
      isPartOf: { '@type': 'WebSite', url: BASE_URL },
      numberOfItems: routes.length,
    },
    routeItems.length > 0
      ? buildItemList(routeItems, `${locale}/explore/${countrySlug}/${regionSlug}`, title)
      : null,
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Explore', href: '/explore' },
          { label: countryName, href: `/explore/${countrySlug}` },
          { label: regionName },
        ]}
      />

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {countryName}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {routeCount} {routeCount === 1 ? 'route' : 'routes'} in {regionName}. Sorted by
            community rating.
          </p>
        </div>
      </section>

      {/* Routes grid */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          {routes.length === 0 ? (
            <p className="text-center text-neutral-500">
              No routes available in {regionName} yet. Check back soon!
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {routes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
