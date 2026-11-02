import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { RouteCard } from '@/components/marketing/route-card';
import { BASE_URL } from '@/lib/constants';
import { fetchRegionBySlug, fetchRoutesByRegion } from '@/lib/fetch-places';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import { definitiveOrThrow } from '@/lib/graphql-server';
import { relativeTrip } from '@/lib/seo/canonical';
import { buildBreadcrumbList, buildGraph, buildItemList, buildWebPage } from '@/lib/seo/schema';
import { reportSoftNotFound } from '@/lib/seo/soft-404';
import '@/components/marketing/trackside-read.css';

// Prerendered (ISR) so `notFound()` returns a REAL 404. What made it a 200 was
// `app/loading.tsx` streaming a shell before the page resolved — `notFound()`
// after streaming starts can only return 200 (Next.js: not-found returns 404 for
// non-streamed responses, 200 for streamed ones). That was the localized half of
// Sentry MOTOVAULT-WEB-P. The boundary is deleted; do not reintroduce one above
// this route. See the trip-detail route for the measured evidence.
export const dynamic = 'force-static';
export const revalidate = 2592000; // 30 days — DB-sourced; invalidated on demand via /api/revalidate on publish/edit

const OG_IMAGE = `${BASE_URL}/images/hero-explore-og.jpg`; // 1200×630 crop under 300 KB (the 732 KB source was fetched raw by every crawler)

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
  // Both inputs decide existence, so a transient API failure must NOT collapse to
  // notFound() — under the force-static ISR above that bakes a cached 404 over a
  // region that really exists. See definitiveOrThrow and the non-localized twin.
  const [places, routes] = await Promise.all([
    definitiveOrThrow(fetchRegionBySlug(countrySlug, regionSlug), null),
    definitiveOrThrow(fetchRoutesByRegion(code, regionSlug, 50), []),
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
  const title = `Motorcycle routes in ${regionName}, ${countryName}`;
  const description =
    routeCount > 0
      ? `${routeCount} motorcycle route${routeCount === 1 ? '' : 's'} in ${regionName}, ${countryName}, each with distance, climb and riding time, rated by riders.`
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

  const title = `Motorcycle routes in ${regionName}, ${countryName}`;
  const description = `${routeCount} motorcycle routes in ${regionName}, ${countryName}, rated by riders.`;
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

      <section className="mv-index">
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Explore', href: '/explore' },
            { label: countryName, href: `/explore/${countrySlug}` },
            { label: regionName },
          ]}
        />

        <header>
          <h1 className="mv-index-h1">
            Motorcycle routes in {regionName}, {countryName}
          </h1>
          <p className="mv-index-lede">
            <span className="mv-figure">{routeCount}</span> {routeCount === 1 ? 'route' : 'routes'}{' '}
            in {regionName}, sorted by rider rating. Distance, climb and an estimated riding time
            for each.
          </p>
        </header>

        {routes.length === 0 ? (
          <p className="mv-empty">No routes published in {regionName} yet. Check back soon.</p>
        ) : (
          <ul className="mv-route-list" style={{ marginTop: 48 }}>
            {routes.map((route) => (
              <li key={route.id}>
                <RouteCard route={route} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
