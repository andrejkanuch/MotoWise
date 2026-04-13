import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapHeroStatic } from '../../../../../components/map-hero-static';
import { fetchRouteBySlug } from '../../../../../lib/fetch-route';
import { formatDate, formatDistance } from '../../../../../lib/format-utils';

interface RoutePageParams {
  country: string;
  region: string;
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RoutePageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const route = await fetchRouteBySlug(slug);
  if (!route) return { title: 'Route Not Found' };

  const title = route.name ?? 'Motorcycle Route';
  const description =
    route.editorialDescription ??
    route.description ??
    `${formatDistance(route.distanceM)} motorcycle route shared on MotoVault`;

  return {
    title: `${title} — MotoVault Routes`,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      images: [`/api/route-hero/${route.id}`],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/route-hero/${route.id}`],
    },
  };
}

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<RoutePageParams>;
}) {
  const { slug } = await params;
  const route = await fetchRouteBySlug(slug);

  if (!route) {
    notFound();
  }

  const distanceKm = formatDistance(route.distanceM);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Static map hero with overlays */}
      <MapHeroStatic
        route={{
          id: route.id,
          polyline: route.polyline,
          startLat: route.startLat,
          startLng: route.startLng,
          distanceM: route.distanceM,
          elevationGainM: route.elevationGainM,
          curvatureIndex: route.curvatureIndex,
          surfaceType: route.surfaceType,
        }}
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        {/* Title + meta */}
        <div className="flex items-start gap-3">
          {route.isMotovaultPick && (
            <span className="mt-1 shrink-0 rounded-full bg-signature-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-signature-500">
              MotoVault Pick
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
              {route.name ?? 'Motorcycle Route'}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Shared {formatDate(route.createdAt)}
              {route.contributorDisplayName && (
                <> by {route.contributorDisplayName}</>
              )}
            </p>
          </div>
        </div>

        {/* Editorial / description */}
        {(route.editorialDescription ?? route.description) && (
          <p className="mt-6 text-base leading-relaxed text-neutral-700">
            {route.editorialDescription ?? route.description}
          </p>
        )}

        {/* Stats grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Distance" value={distanceKm} />
          {route.elevationGainM != null && route.elevationGainM > 0 && (
            <StatCard
              label="Elevation"
              value={`${Math.round(route.elevationGainM)} m`}
            />
          )}
          {route.ratingAvg != null && route.ratingCount > 0 && (
            <StatCard
              label="Rating"
              value={`${route.ratingAvg.toFixed(1)} / 5`}
            />
          )}
          {route.commentCount > 0 && (
            <StatCard
              label="Reviews"
              value={route.commentCount.toString()}
            />
          )}
        </div>
      </main>

      {/* Bottom CTA */}
      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-lg font-bold text-neutral-900">
            Explore this route in MotoVault
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Navigate turn-by-turn, track your ride, and discover more routes
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="https://apps.apple.com/app/motovault/id6745417382"
              className="inline-flex items-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Get MotoVault
            </a>
            <a
              href="/signup"
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              Create Account
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
      <p className="text-xl font-bold text-neutral-900">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
