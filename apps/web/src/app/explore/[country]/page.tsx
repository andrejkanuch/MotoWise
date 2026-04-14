import { palette } from '@motovault/design-system';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SaveRouteButton } from '@/components/save-route-button';
import { BASE_URL, getHreflangMap } from '@/lib/constants';
import {
  fetchCountryBySlug,
  fetchRegionsByCountrySlug,
  fetchRoutesByCountry,
} from '@/lib/fetch-places';

export const revalidate = 86400;

const OG_IMAGE = `${BASE_URL}/images/hero-explore.jpg`;

interface PageProps {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return {};

  const title = `Motorcycle Routes in ${country.name}`;
  const rc = country.routeCount;
  const description =
    rc > 0
      ? `Explore ${rc} motorcycle route${rc === 1 ? '' : 's'} in ${country.name}. Twisty roads, scenic passes, and rides rated by riders on MotoVault.`
      : `Motorcycle routes in ${country.name} are coming soon. Browse other countries on MotoVault or share a ride from the app.`;

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

  if (rc === 0) {
    return { ...base, robots: { index: false, follow: true } };
  }

  return base;
}

function getDifficulty(curvature: number | null | undefined): { label: string; color: string } {
  if (curvature == null) return { label: '', color: palette.neutral500 };
  if (curvature >= 0.06) return { label: 'Expert', color: palette.danger500 };
  if (curvature >= 0.03) return { label: 'Intermediate', color: palette.warning500 };
  return { label: 'Easy', color: palette.success500 };
}

export default async function CountryPage({ params }: PageProps) {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) notFound();

  const [regions, topRoutes] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug),
    fetchRoutesByCountry(country.countryCode, 12),
  ]);

  return (
    <main className="min-h-screen text-neutral-50">
      {/* Header — simple, left-aligned */}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-8 sm:px-6">
        <nav className="mb-6 text-sm text-neutral-500">
          <a href="/explore" className="hover:text-neutral-300 transition-colors">
            Explore
          </a>
          <span className="mx-2">/</span>
          <span className="text-neutral-300">{country.name}</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{country.name}</h1>
        <p className="mt-2 text-base text-neutral-400">
          {topRoutes.length} route{topRoutes.length !== 1 ? 's' : ''}{' '}
          {regions.length > 0 && (
            <>
              across {regions.length} region{regions.length !== 1 ? 's' : ''}
            </>
          )}
        </p>
      </section>

      {/* Regions — compact list, not identical cards */}
      {regions.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {regions.map((region) => (
              <a
                key={region.id}
                href={`/explore/${countrySlug}/${region.slug}`}
                className="rounded-full border border-neutral-800/50 px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white"
              >
                {region.name}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Routes — varied layout: first route larger, rest in grid */}
      {topRoutes.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <h2 className="mb-6 text-lg font-semibold text-neutral-200">Routes</h2>

          {/* Featured route — wider */}
          {topRoutes[0] && (
            <a
              href={
                topRoutes[0].countryCode && topRoutes[0].regionSlug && topRoutes[0].slug
                  ? `/route/${topRoutes[0].countryCode.toLowerCase()}/${topRoutes[0].regionSlug}/${topRoutes[0].slug}`
                  : `/routes/${topRoutes[0].id}`
              }
              className="group mb-6 block rounded-xl bg-neutral-900/40 p-5 transition-colors hover:bg-neutral-900/60"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-neutral-50 group-hover:text-neutral-200 transition-colors">
                    {topRoutes[0].displayName ?? topRoutes[0].name ?? 'Unnamed Route'}
                  </h3>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-400">
                    {topRoutes[0].distanceM > 0 && (
                      <span>{(topRoutes[0].distanceM / 1000).toFixed(1)} km</span>
                    )}
                    {topRoutes[0].elevationGainM != null && (
                      <span>{Math.round(topRoutes[0].elevationGainM)}m gain</span>
                    )}
                    {topRoutes[0].ratingAvg != null && (
                      <span className="text-neutral-300">
                        ★ {topRoutes[0].ratingAvg.toFixed(1)}
                      </span>
                    )}
                    {(() => {
                      const d = getDifficulty(topRoutes[0].curvatureIndex);
                      return d.label ? <span style={{ color: d.color }}>{d.label}</span> : null;
                    })()}
                  </p>
                </div>
                <SaveRouteButton routeId={topRoutes[0].id} />
              </div>
            </a>
          )}

          {/* Rest of routes — compact list */}
          <div className="divide-y divide-neutral-800/30">
            {topRoutes.slice(1).map((route) => {
              const diff = getDifficulty(route.curvatureIndex);
              const href =
                route.countryCode && route.regionSlug && route.slug
                  ? `/route/${route.countryCode.toLowerCase()}/${route.regionSlug}/${route.slug}`
                  : `/routes/${route.id}`;
              return (
                <a
                  key={route.id}
                  href={href}
                  className="group flex items-center justify-between py-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">
                      {route.displayName ?? route.name ?? 'Unnamed Route'}
                    </h3>
                    <p className="mt-0.5 flex gap-x-3 text-xs text-neutral-500">
                      {route.distanceM > 0 && <span>{(route.distanceM / 1000).toFixed(1)} km</span>}
                      {route.elevationGainM != null && (
                        <span>{Math.round(route.elevationGainM)}m</span>
                      )}
                      {route.ratingAvg != null && <span>★ {route.ratingAvg.toFixed(1)}</span>}
                      {diff.label && <span style={{ color: diff.color }}>{diff.label}</span>}
                    </p>
                  </div>
                  <SaveRouteButton routeId={route.id} />
                </a>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
