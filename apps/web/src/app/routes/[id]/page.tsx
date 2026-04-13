import { palette } from '@motovault/design-system';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { BASE_URL } from '@/lib/constants';
import { fetchRouteDetail, fetchRouteReviews, type RouteReview } from '@/lib/fetch-route-detail';
import { formatDate, formatDistance } from '@/lib/format-utils';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { RouteDetailReviews } from './route-detail-reviews';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const route = await fetchRouteDetail(id);
  if (!route) return { title: 'Route Not Found' };

  const title = route.name ?? 'Motorcycle Route';
  const description =
    route.editorialDescription ??
    route.description ??
    `${formatDistance(route.distanceM)} motorcycle route on MotoVault`;

  return {
    title: `${title} | MotoVault Routes`,
    description,
    openGraph: {
      title: `${title} | MotoVault Routes`,
      description,
      type: 'article',
      url: `${BASE_URL}/routes/${route.id}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [route, reviewsData, supabase] = await Promise.all([
    fetchRouteDetail(id),
    fetchRouteReviews(id, 10),
    getSupabaseServerClient(),
  ]);

  if (!route) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  const reviews = reviewsData?.reviews ?? [];
  const totalCount = reviewsData?.totalCount ?? 0;
  const hasMore = reviewsData?.hasNextPage ?? false;

  // For anonymous users, the API already caps reviews at 3 (MOT-166).
  // We show those 3 visible + blur the rest behind the soft wall.
  // For SEO, all reviews remain in the DOM as JSON-LD.

  // --- JSON-LD: AggregateRating + Review array ---
  const jsonLdNodes = buildRouteJsonLd(route, reviews, totalCount);

  return (
    <div className="min-h-screen" style={{ backgroundColor: palette.neutral950 }}>
      {/* JSON-LD for SEO (all reviews included regardless of auth) */}
      <JsonLdGraph nodes={jsonLdNodes} />

      {/* Hero */}
      <div
        className="relative h-48 sm:h-64"
        style={{
          background: `linear-gradient(135deg, ${palette.gradientHeroStart}, ${palette.gradientHeroMid}, ${palette.gradientHeroEnd})`,
        }}
      >
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
            {route.isMotovaultPick && (
              <span
                className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: palette.signature500,
                  color: palette.white,
                }}
              >
                MotoVault Pick
              </span>
            )}
            <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: palette.white }}>
              {route.name ?? 'Motorcycle Route'}
            </h1>
            <p className="mt-1 text-sm" style={{ color: palette.neutral300 }}>
              Shared by {route.contributor.displayName} &middot; {formatDate(route.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Description */}
        {(route.editorialDescription || route.description) && (
          <p className="text-base leading-relaxed" style={{ color: palette.neutral300 }}>
            {route.editorialDescription ?? route.description}
          </p>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Distance" value={formatDistance(route.distanceM)} />
          {route.elevationGainM != null && route.elevationGainM > 0 && (
            <StatCard label="Elevation Gain" value={`${Math.round(route.elevationGainM)}m`} />
          )}
          {route.surfaceType && <StatCard label="Surface" value={route.surfaceType} />}
          {route.curvatureIndex != null && (
            <StatCard label="Curvature" value={`${route.curvatureIndex.toFixed(1)}/10`} />
          )}
        </div>

        {/* Rating summary */}
        {route.ratingAvg != null && route.ratingCount > 0 && (
          <div className="mt-8 flex items-center gap-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static star list
                <StarIcon key={i} filled={i < Math.round(route.ratingAvg ?? 0)} />
              ))}
            </div>
            <span className="text-sm font-medium" style={{ color: palette.neutral300 }}>
              {route.ratingAvg.toFixed(1)} ({route.ratingCount}{' '}
              {route.ratingCount === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        )}

        {/* Reviews section */}
        <RouteDetailReviews
          reviews={reviews}
          totalCount={totalCount}
          hasMore={hasMore}
          isAuthenticated={isAuthenticated}
        />
      </main>
    </div>
  );
}

// ---- Helpers ----

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-4 text-center"
      style={{
        borderColor: palette.neutral800,
        backgroundColor: palette.neutral900,
      }}
    >
      <p className="text-xl font-bold" style={{ color: palette.white }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: palette.neutral500 }}>
        {label}
      </p>
    </div>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 20 20"
      fill={filled ? palette.signature400 : palette.neutral700}
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

// ---- JSON-LD Builder ----

function buildRouteJsonLd(
  route: Awaited<ReturnType<typeof fetchRouteDetail>> & {},
  reviews: RouteReview[],
  totalCount: number,
): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];

  // WebPage
  nodes.push({
    '@type': 'WebPage',
    '@id': `${BASE_URL}/routes/${route.id}#page`,
    url: `${BASE_URL}/routes/${route.id}`,
    name: route.name ?? 'Motorcycle Route',
    description:
      route.editorialDescription ?? route.description ?? 'A motorcycle route on MotoVault',
    inLanguage: 'en',
  });

  // Place (the route as a geographic entity)
  const placeNode: Record<string, unknown> = {
    '@type': 'Place',
    '@id': `${BASE_URL}/routes/${route.id}#place`,
    name: route.name ?? 'Motorcycle Route',
    description:
      route.editorialDescription ?? route.description ?? 'A motorcycle route on MotoVault',
  };

  // AggregateRating
  if (route.ratingAvg != null && totalCount > 0) {
    placeNode.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: route.ratingAvg.toFixed(1),
      reviewCount: String(totalCount),
      bestRating: '5',
      worstRating: '1',
    };
  }

  // Individual Review items (all reviews for SEO, even those behind the wall)
  if (reviews.length > 0) {
    placeNode.review = reviews.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author.displayName },
      datePublished: r.createdAt,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: String(r.rating),
        bestRating: '5',
        worstRating: '1',
      },
      ...(r.text ? { reviewBody: r.text } : {}),
    }));
  }

  nodes.push(placeNode);

  return nodes;
}
