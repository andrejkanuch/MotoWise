import { palette } from '@motovault/design-system';
import type { RouteBySlugPagePayload, RouteReview } from '@motovault/types';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GpxDownloadButton } from '@/components/gpx-download-button';
import { RouteMapSection } from '@/components/route-map-section';
import { SaveRouteButton } from '@/components/save-route-button';
import { BASE_URL } from '@/lib/constants';
import { decodePolyline } from '@/lib/decode-polyline';
import { countryDisplayName, regionDisplayName } from '@/lib/geo-names';
import { buildStaticMapUrl } from '@/lib/map/static-image-provider';
import { ROUTE_EDITORIAL } from '@/lib/seo/route-editorial';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { OpenInAppCta } from './open-in-app-cta';
import { RouteDetailReviewsSection } from './route-detail-reviews-section';
import { ShareButton } from './share-button';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';

const ROUTE_BY_SLUG_QUERY = `
  query RouteBySlug($country: String!, $region: String!, $slug: String!) {
    routeBySlug(country: $country, region: $region, slug: $slug) {
      id
      name
      description
      polyline
      distanceM
      elevationGainM
      surfaceType
      curvatureIndex
      isMotovaultPick
      editorialDescription
      ratingAvg
      ratingCount
      commentCount
      status
      createdAt
      contributor {
        id
        displayName
        publicUsername
        avatarUrl
      }
    }
  }
`;

const ROUTE_REVIEWS_QUERY = `
  query GetRouteReviews($routeId: ID!, $first: Int) {
    getRouteReviews(routeId: $routeId, first: $first) {
      reviews {
        id
        rating
        text
        conditionTags
        createdAt
        author {
          id
          displayName
          publicUsername
          avatarUrl
        }
        bike {
          make
          model
          year
        }
      }
      hasNextPage
      endCursor
      totalCount
    }
  }
`;

async function fetchRoute(
  country: string,
  region: string,
  slug: string,
): Promise<RouteBySlugPagePayload | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ROUTE_BY_SLUG_QUERY,
        variables: { country, region, slug },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.routeBySlug) return null;
    return json.data.routeBySlug;
  } catch {
    return null;
  }
}

async function fetchReviews(
  routeId: string,
  first = 10,
): Promise<{
  reviews: RouteReview[];
  totalCount: number;
  hasNextPage: boolean;
} | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: ROUTE_REVIEWS_QUERY,
        variables: { routeId, first },
      }),
      next: { revalidate: 300 },
    });
    const json = await res.json();
    if (json.errors || !json.data?.getRouteReviews) return null;
    return json.data.getRouteReviews;
  } catch {
    return null;
  }
}

// ── Formatting helpers ─────────────────────────────────────────────

function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km >= 100 ? `${Math.round(km)}` : `${km.toFixed(1)}`;
}

function formatElevation(meters: number): string {
  return `${Math.round(meters).toLocaleString()}`;
}

function formatDuration(meters: number): string {
  const hours = meters / 1000 / 60;
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDifficulty(curvature: number | null | undefined): {
  label: string;
  color: string;
  level: number;
} {
  if (curvature == null) return { label: 'Unknown', color: palette.neutral400, level: 0 };
  if (curvature >= 0.06) return { label: 'Expert', color: palette.danger500, level: 5 };
  if (curvature >= 0.045) return { label: 'Advanced', color: palette.signature500, level: 4 };
  if (curvature >= 0.03) return { label: 'Intermediate', color: palette.warning500, level: 3 };
  if (curvature >= 0.015) return { label: 'Moderate', color: palette.accent400, level: 2 };
  return { label: 'Easy', color: palette.success500, level: 1 };
}

function getSurfaceLabel(type: string | null | undefined): string {
  if (!type) return 'Unknown';
  switch (type) {
    case 'paved':
      return 'Paved';
    case 'mixed':
      return 'Mixed';
    case 'off-road':
      return 'Off-Road';
    default:
      return type;
  }
}

function getCurvatureLabel(index: number | null | undefined): string {
  if (index == null) return 'Unknown';
  if (index >= 0.06) return 'Very Twisty';
  if (index >= 0.03) return 'Twisty';
  if (index >= 0.015) return 'Some Curves';
  return 'Mostly Straight';
}

function prettifyRegion(regionSlug: string, countrySlug: string): string {
  return regionDisplayName(regionSlug, countrySlug);
}

function prettifyCountry(slug: string): string {
  return countryDisplayName(slug);
}

// ── Metadata ───────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; region: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, country, region } = await params;
  const route = await fetchRoute(country, region, slug);
  if (!route) return { title: 'Route Not Found' };

  const title = route.name ?? 'Motorcycle Route';
  const description =
    route.editorialDescription ??
    route.description ??
    `${formatDistance(route.distanceM)} km motorcycle route in ${prettifyRegion(region, country)}, ${prettifyCountry(country)}`;

  const canonicalUrl = `${BASE_URL}/route/${country}/${region}/${slug}`;
  const staticMap =
    route.polyline && route.polyline.length > 0
      ? buildStaticMapUrl({
          polyline: route.polyline,
          width: 1200,
          height: 630,
          strokeColor: 'd97706',
          retina: true,
        })
      : '';
  const ogImage = staticMap.length > 0 ? staticMap : null;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonicalUrl,
      siteName: 'MotoVault',
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

// ── Page ───────────────────────────────────────────────────────────

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ country: string; region: string; slug: string }>;
}) {
  const { slug, country, region } = await params;
  const route = await fetchRoute(country, region, slug);
  if (!route) notFound();

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hasSession = !!user;

  const reviewsData = await fetchReviews(route.id, 10);
  const reviews = reviewsData?.reviews ?? [];
  const totalReviewCount = reviewsData?.totalCount ?? 0;
  const hasMoreReviews = reviewsData?.hasNextPage ?? false;

  const difficulty = getDifficulty(route.curvatureIndex);
  const surfaceLabel = getSurfaceLabel(route.surfaceType);
  const routeName = route.name ?? 'Unnamed Route';
  const regionName = prettifyRegion(region, country);
  const countryName = prettifyCountry(country);
  const editorialText = route.editorialDescription ?? route.description;
  const routeKey = `${country}/${region}/${slug}`;
  const editorial = ROUTE_EDITORIAL[routeKey] ?? null;
  const decodedPolyline = route.polyline ? decodePolyline(route.polyline) : [];
  const staticPreviewUrl =
    route.polyline && route.polyline.length > 0
      ? buildStaticMapUrl({
          polyline: route.polyline,
          width: 1280,
          height: 800,
          strokeColor: 'd97706',
          retina: true,
        }) || null
      : null;

  // JSON-LD structured data
  const midIdx = Math.floor(decodedPolyline.length / 2);
  const midpoint = decodedPolyline[midIdx] ?? decodedPolyline[0];

  const routeSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: routeName,
    description:
      editorialText ??
      `${formatDistance(route.distanceM)} km motorcycle route in ${regionName}, ${countryName}`,
    url: `${BASE_URL}/route/${country}/${region}/${slug}`,
    geo: midpoint
      ? {
          '@type': 'GeoCoordinates',
          latitude: midpoint[0],
          longitude: midpoint[1],
        }
      : undefined,
    address: {
      '@type': 'PostalAddress',
      addressRegion: regionName,
      addressCountry: countryName,
    },
    touristType: 'Motorcyclist',
    isAccessibleForFree: true,
  };

  if (route.ratingAvg != null && route.ratingCount > 0) {
    routeSchema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: route.ratingAvg.toFixed(1),
      reviewCount: String(route.ratingCount),
      bestRating: '5',
      worstRating: '1',
    };
  }

  // Aggregate condition tags from reviews
  const conditionTagCounts: Record<string, number> = {};
  for (const review of reviews) {
    for (const tag of review.conditionTags) {
      conditionTagCounts[tag] = (conditionTagCounts[tag] ?? 0) + 1;
    }
  }
  const topConditionTags = Object.entries(conditionTagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen text-neutral-50">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{ __html: JSON.stringify(routeSchema).replace(/</g, '\\u003c') }}
      />
      {/* ── Breadcrumb ── */}
      <nav className="border-b border-neutral-800/40">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 text-sm sm:px-6">
          <a href="/explore" className="text-neutral-400 transition-colors hover:text-neutral-200">
            Explore
          </a>
          <span className="text-neutral-600">/</span>
          <a
            href={`/explore/${country}`}
            className="text-neutral-400 transition-colors hover:text-neutral-200"
          >
            {countryName}
          </a>
          <span className="text-neutral-600">/</span>
          <span className="max-w-[200px] truncate text-neutral-300">{routeName}</span>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-50 sm:text-4xl lg:text-[2.75rem]">
            {routeName}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {route.isMotovaultPick && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: palette.signatureBgDark, color: palette.signature400 }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <title>Editor&apos;s pick</title>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Editor&apos;s Pick
              </span>
            )}
            {route.ratingAvg != null && route.ratingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-200">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={palette.warning500}
                  aria-hidden="true"
                >
                  <title>Rating</title>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {route.ratingAvg.toFixed(1)}
                <span className="text-neutral-500">
                  ({route.ratingCount} {route.ratingCount === 1 ? 'review' : 'reviews'})
                </span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: difficulty.color }}
              />
              <span className="text-neutral-300">{difficulty.label}</span>
            </span>
            <span className="text-sm text-neutral-400">&middot;</span>
            <span className="text-sm text-neutral-300">{surfaceLabel}</span>
            <span className="text-sm text-neutral-400">&middot;</span>
            <span className="text-sm text-neutral-400">
              {regionName}, {countryName}
            </span>
          </div>
        </div>

        {/* Map hero + action buttons */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-neutral-800/60 bg-neutral-900">
          <RouteMapSection
            polyline={decodedPolyline}
            staticPreviewUrl={staticPreviewUrl}
            mapInstanceKey={route.id}
          />
          <div className="absolute right-4 top-4 z-10 flex items-start gap-2">
            <SaveRouteButton routeId={route.id} />
            <ShareButton routeName={routeName} />
            <GpxDownloadButton
              routeId={route.id}
              routeName={routeName}
              isAuthenticated={hasSession}
            />
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="py-4 text-sm text-neutral-400">
          {formatDistance(route.distanceM)} km
          {route.elevationGainM != null && route.elevationGainM > 0 && (
            <> &middot; {formatElevation(route.elevationGainM)}m elevation gain</>
          )}{' '}
          &middot; {formatDuration(route.distanceM)} est.
          {route.curvatureIndex != null && (
            <>
              {' '}
              &middot;{' '}
              <span style={{ color: difficulty.color }}>
                {getCurvatureLabel(route.curvatureIndex)}
              </span>
            </>
          )}{' '}
          &middot; {surfaceLabel}
        </p>
      </div>

      {/* ── Content Section ── */}
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-3">
          {/* ── Left column ── */}
          <div className="space-y-8 lg:col-span-2">
            {/* Description */}
            {editorialText && (
              <section>
                <p className="text-base leading-relaxed text-neutral-300">{editorialText}</p>
              </section>
            )}

            {/* ── Expanded Editorial Content ── */}
            {editorial && (
              <div className="space-y-6">
                {editorial.introduction && !editorialText && (
                  <p className="text-base leading-relaxed text-neutral-300">
                    {editorial.introduction}
                  </p>
                )}
                {editorial.sections.map((section) => (
                  <div key={section.heading}>
                    <h2 className="mb-3 text-xl font-semibold text-neutral-100">
                      {section.heading}
                    </h2>
                    <p className="text-base leading-relaxed text-neutral-300">{section.content}</p>
                  </div>
                ))}
                {editorial.faqs.length > 0 && (
                  <div className="border-t border-neutral-800/40 pt-6">
                    <h2 className="mb-4 text-xl font-semibold text-neutral-100">
                      Frequently Asked Questions
                    </h2>
                    <dl className="space-y-4">
                      {editorial.faqs.map((faq) => (
                        <div key={faq.question}>
                          <dt className="text-base font-medium text-neutral-200">{faq.question}</dt>
                          <dd className="mt-1 text-sm leading-relaxed text-neutral-400">
                            {faq.answer}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            )}

            {/* ── Condition Tags from reviews ── */}
            {topConditionTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topConditionTags.map(([tag, count]) => (
                  <ConditionTagBadge key={tag} tag={tag} count={count} />
                ))}
              </div>
            )}

            {/* ── Reviews ── */}
            <section className="border-t border-neutral-800/40 pt-8">
              <RouteDetailReviewsSection
                reviews={reviews}
                totalCount={totalReviewCount}
                hasMore={hasMoreReviews}
                isAuthenticated={hasSession}
                ratingAvg={route.ratingAvg ?? null}
              />
            </section>

            {/* ── Contributor ── */}
            <p className="text-xs text-neutral-600">
              Added by{' '}
              {route.contributor.publicUsername ? (
                <a
                  href={`/u/${route.contributor.publicUsername}`}
                  className="text-neutral-400 underline decoration-neutral-700 underline-offset-2 hover:decoration-neutral-500"
                >
                  {route.contributor.displayName}
                </a>
              ) : (
                <span className="text-neutral-400">{route.contributor.displayName}</span>
              )}{' '}
              &middot;{' '}
              {new Date(route.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-8">
            {/* Rating — no card, just numbers */}
            {route.ratingAvg != null && route.ratingCount > 0 && (
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums text-neutral-50">
                    {route.ratingAvg.toFixed(1)}
                  </span>
                  <span className="text-sm text-neutral-500">/ 5</span>
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  {route.ratingCount} {route.ratingCount === 1 ? 'review' : 'reviews'}
                </p>
              </div>
            )}

            {/* CTA — platform-aware */}
            <OpenInAppCta />

            {/* Quick facts */}
            <dl className="space-y-2.5 border-t border-neutral-800/30 pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Region</dt>
                <dd className="text-neutral-200">{regionName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Country</dt>
                <dd className="text-neutral-200">{countryName}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Components ──────────────────────────────────────────────────────

function ConditionTagBadge({ tag, count }: { tag: string; count: number }) {
  const tagStyles: Record<string, { bg: string; text: string }> = {
    'Good Surface': { bg: `${palette.success500}15`, text: palette.success500 },
    'Gravel Hazard': { bg: `${palette.warning500}15`, text: palette.warning500 },
    Construction: { bg: `${palette.danger500}15`, text: palette.danger500 },
    'Low Traffic': { bg: `${palette.accent400}15`, text: palette.accent400 },
    'Heavy Traffic': { bg: `${palette.signature500}15`, text: palette.signature500 },
    Scenic: { bg: `${palette.primary400}15`, text: palette.primary400 },
    'Technical Curves': { bg: `${palette.indigo400}15`, text: palette.indigo400 },
  };
  const style = tagStyles[tag] ?? {
    bg: `${palette.neutral500}15`,
    text: palette.neutral400,
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {tag}
      {count > 1 && <span className="text-xs opacity-60">&times;{count}</span>}
    </span>
  );
}
