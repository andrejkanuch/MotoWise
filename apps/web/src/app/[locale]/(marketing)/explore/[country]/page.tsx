import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/marketing/breadcrumb';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { RouteCard } from '@/components/marketing/route-card';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import {
  fetchCountryBySlug,
  fetchRegionsByCountrySlug,
  fetchRoutesByCountry,
} from '@/lib/fetch-places';
import { COUNTRY_INTROS } from '@/lib/seo/country-intros';
import { buildBreadcrumbList, buildGraph, buildItemList, buildWebPage } from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

// Prerendered (ISR) so `notFound()` returns a REAL 404. What made it a 200 was
// `app/loading.tsx` streaming a shell before the page resolved — `notFound()`
// after streaming starts can only return 200 (Next.js: not-found returns 404 for
// non-streamed responses, 200 for streamed ones). That was the localized half of
// Sentry MOTOVAULT-WEB-R. The boundary is deleted; do not reintroduce one above
// this route. See the trip-detail route for the measured evidence.
export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ locale: string; country: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, country: countrySlug } = await params;
  setRequestLocale(locale);

  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return {};

  const title = `Motorcycle routes in ${country.name}`;
  const rc = country.routeCount;
  const description =
    rc > 0
      ? `Motorcycle routes in ${country.name}: ${rc} route${rc === 1 ? '' : 's'} by region, each with distance, climb and riding time, rated by riders.`
      : `Motorcycle routes in ${country.name} are coming soon. Browse other countries on MotoVault or share a ride from the app.`;

  // Explore content is not translated — always canonical to the non-localized version
  // to prevent Google from seeing locale variants as duplicates.
  const canonical = `${BASE_URL}/explore/${countrySlug}`;

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

  if (rc === 0) {
    return { ...base, robots: { index: false, follow: true } };
  }

  return base;
}

export default async function CountryPage({ params }: PageProps) {
  const { locale, country: countrySlug } = await params;
  setRequestLocale(locale);

  const country = await fetchCountryBySlug(countrySlug);
  if (!country) notFound();

  // A transient API/DB error on the parallel fetch must degrade to the empty
  // state rather than 500 the whole page (see /pt-BR/explore/us incident). The
  // notFound() above already handles genuinely missing countries.
  const [regions, topRoutes] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug),
    fetchRoutesByCountry(country.countryCode, 12),
  ]).catch(() => [[], []] as const);

  const introContent = COUNTRY_INTROS[countrySlug] ?? null;

  const title = `Motorcycle routes in ${country.name}`;
  const description = `Motorcycle routes in ${country.name}: ${country.routeCount} routes by region, rated by riders.`;
  const canonical = getCanonicalUrl(locale, `/explore/${countrySlug}`);

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: title,
      description,
      locale,
      pageKey: `/explore/${countrySlug}`,
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Explore', url: getCanonicalUrl(locale, '/explore') },
        { name: country.name, url: canonical },
      ],
      locale,
      `/explore/${countrySlug}`,
    ),
    regions.length > 0
      ? buildItemList(
          regions.map((region) => ({
            name: region.name,
            url: getCanonicalUrl(locale, `/explore/${countrySlug}/${region.slug}`),
          })),
          `${locale}/explore/${countrySlug}`,
          `Motorcycle routes by region in ${country.name}`,
        )
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
            { label: country.name },
          ]}
        />

        <header>
          <h1 className="mv-index-h1">Motorcycle routes in {country.name}</h1>
          <p className="mv-index-lede">
            <span className="mv-figure">{country.routeCount}</span>{' '}
            {country.routeCount === 1 ? 'route' : 'routes'} across{' '}
            {regions.length > 0 ? (
              <>
                <span className="mv-figure">{regions.length}</span>{' '}
                {regions.length === 1 ? 'region' : 'regions'}
              </>
            ) : (
              'the country'
            )}
            , shared and rated by riders. Open any route in the app to export the GPX.
          </p>
        </header>

        {introContent && (
          <div className="mv-read-body" style={{ marginTop: 40 }}>
            {introContent.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>
        )}

        {regions.length > 0 && (
          <section className="mv-read-section" aria-labelledby="regions-heading">
            <h2 id="regions-heading" className="mv-read-h2">
              Regions
            </h2>
            <ul className="mv-places" style={{ marginTop: 8 }}>
              {regions.map((region) => (
                <li key={region.id}>
                  <Link href={`/explore/${countrySlug}/${region.slug}`}>
                    <span className="mv-places-name">{region.name}</span>
                    <span className="mv-places-count">
                      <span className="mv-figure">{region.routeCount}</span>
                      {region.routeCount === 1 ? 'route' : 'routes'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {topRoutes.length > 0 && (
          <section className="mv-read-section" aria-labelledby="top-routes-heading">
            <h2 id="top-routes-heading" className="mv-read-h2">
              Top-rated routes in {country.name}
            </h2>
            <ul className="mv-route-list" style={{ marginTop: 8 }}>
              {topRoutes.map((route) => (
                <li key={route.id}>
                  <RouteCard route={route} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {regions.length === 0 && topRoutes.length === 0 && (
          <p className="mv-empty">No routes published in {country.name} yet. Check back soon.</p>
        )}
      </section>
    </>
  );
}
