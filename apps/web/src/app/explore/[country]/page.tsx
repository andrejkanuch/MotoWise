import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  fetchCountryBySlug,
  fetchRegionsByCountrySlug,
  fetchRoutesByCountry,
} from '@/lib/fetch-places';

export const revalidate = 86400; // 24 hours

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://motovault.app';

interface PageProps {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) return {};

  const title = `Motorcycle Routes in ${country.name}`;
  const description = `Discover the best motorcycle routes in ${country.name}. Browse twisty roads, scenic passes, and epic rides.`;

  return {
    title: { absolute: `${title} | MotoVault` },
    description,
    alternates: { canonical: `${BASE_URL}/explore/${countrySlug}` },
  };
}

export default async function CountryPage({ params }: PageProps) {
  const { country: countrySlug } = await params;
  const country = await fetchCountryBySlug(countrySlug);
  if (!country) notFound();

  const [regions, topRoutes] = await Promise.all([
    fetchRegionsByCountrySlug(countrySlug),
    fetchRoutesByCountry(country.countryCode, 12),
  ]);

  const title = `Motorcycle Routes in ${country.name}`;

  return (
    <main className="min-h-screen bg-neutral-950">
      {/* Hero */}
      <section className="px-6 pb-16 pt-20 md:pb-24 md:pt-28">
        <div className="mx-auto max-w-4xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
            {country.name}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-amber-500" />
        </div>
      </section>

      {/* Regions grid */}
      {regions.length > 0 && (
        <section className="px-6 pb-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-50">
              Regions
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {regions.map((region) => (
                <a
                  key={region.id}
                  href={`/explore/${countrySlug}/${region.slug}`}
                  className="group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 transition-colors hover:border-amber-500/40"
                >
                  <h3 className="text-lg font-semibold text-neutral-50 group-hover:text-amber-400 transition-colors">
                    {region.name}
                  </h3>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-amber-400 group-hover:text-amber-300">
                    View routes &rarr;
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top Routes */}
      {topRoutes.length > 0 && (
        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight text-neutral-50">
              Top Routes
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topRoutes.map((route) => (
                <a
                  key={route.id}
                  href={`/routes/${route.id}`}
                  className="group overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700"
                >
                  <h3 className="text-base font-semibold text-neutral-50 group-hover:text-amber-400 transition-colors">
                    {route.displayName ?? route.name ?? 'Unnamed Route'}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-400">
                    {route.distanceM > 0 && (
                      <span>{(route.distanceM / 1000).toFixed(1)} km</span>
                    )}
                    {route.elevationGainM != null && (
                      <span>↑ {Math.round(route.elevationGainM)} m</span>
                    )}
                    {route.ratingAvg != null && (
                      <span>★ {route.ratingAvg.toFixed(1)}</span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Back link */}
      <div className="px-6 pb-16 text-center">
        <a
          href="/explore"
          className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          ← Back to all countries
        </a>
      </div>
    </main>
  );
}
