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

function countrySlugToCode(slug: string): string {
  const map: Record<string, string> = {
    'united-states': 'US',
    usa: 'US',
    germany: 'DE',
    france: 'FR',
    italy: 'IT',
    spain: 'ES',
    austria: 'AT',
    switzerland: 'CH',
    'united-kingdom': 'UK',
    portugal: 'PT',
    greece: 'GR',
    croatia: 'HR',
    norway: 'NO',
    sweden: 'SE',
    romania: 'RO',
    canada: 'CA',
    mexico: 'MX',
    brazil: 'BR',
    argentina: 'AR',
    colombia: 'CO',
    chile: 'CL',
    peru: 'PE',
    'czech-republic': 'CZ',
    poland: 'PL',
    netherlands: 'NL',
    belgium: 'BE',
    ireland: 'IE',
    scotland: 'SC',
    'costa-rica': 'CR',
    ecuador: 'EC',
    bolivia: 'BO',
    uruguay: 'UY',
    'dominican-republic': 'DO',
  };
  return map[slug] ?? slug.slice(0, 2).toUpperCase();
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

// ── CSS variables (matching feature.css tokens) ───────────────────

const cssVars = {
  bg: 'oklch(0.12 0.01 55)',
  bg2: 'oklch(0.09 0.008 55)',
  surface: 'oklch(0.15 0.012 55)',
  ink: 'oklch(0.98 0.006 80)',
  ink2: 'oklch(0.78 0.012 70)',
  ink3: 'oklch(0.58 0.012 65)',
  ink4: 'oklch(0.4 0.012 60)',
  line: 'oklch(1 0 0 / 0.07)',
  warm500: 'oklch(0.76 0.18 60)',
  warm400: 'oklch(0.84 0.15 68)',
  warm300: 'oklch(0.9 0.11 72)',
  success: 'oklch(0.72 0.2 145)',
} as const;

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

  const countryCode = countrySlugToCode(country);

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

  // Split route name into lines for giant title
  const titleWords = routeName.split(' ');
  const titleLines: string[] = [];
  if (titleWords.length <= 2) {
    titleLines.push(routeName);
  } else if (titleWords.length <= 4) {
    const mid = Math.ceil(titleWords.length / 2);
    titleLines.push(titleWords.slice(0, mid).join(' '));
    titleLines.push(titleWords.slice(mid).join(' '));
  } else {
    const third = Math.ceil(titleWords.length / 3);
    titleLines.push(titleWords.slice(0, third).join(' '));
    titleLines.push(titleWords.slice(third, third * 2).join(' '));
    titleLines.push(titleWords.slice(third * 2).join(' '));
  }

  return (
    <div style={{ background: cssVars.bg, color: cssVars.ink, minHeight: '100vh' }}>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: scoped CSS for route hero
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes bgBreath {
              0% { transform: scale(1.05); }
              100% { transform: scale(1.12); }
            }
            .rh-icon-btn:hover {
              background: oklch(1 0 0 / 0.08) !important;
              border-color: oklch(1 0 0 / 0.16) !important;
            }
            .rh-crumb-link:hover { color: ${cssVars.warm400} !important; }
            .rh-stat { border-right: 1px solid ${cssVars.line}; }
            .rh-stat:last-child { border-right: none; }
            @media (max-width: 900px) {
              .rh-bottom-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
              .rh-actions { align-items: flex-start !important; }
              .rh-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
              .rh-stat { border-bottom: 1px solid ${cssVars.line}; }
            }
            @media (max-width: 720px) {
              .rh-hero { padding: 120px 24px 40px !important; }
              .rsec-wrapper { padding: 80px 24px !important; }
            }
          `,
        }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
        dangerouslySetInnerHTML={{ __html: JSON.stringify(routeSchema).replace(/</g, '\\u003c') }}
      />

      {/* ═══════════════ HERO (full-viewport) ═══════════════ */}
      <section
        className="rh-hero"
        style={{
          position: 'relative',
          minHeight: '100vh',
          padding: '140px 40px 60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          isolation: 'isolate',
          overflow: 'hidden',
        }}
      >
        {/* Background image */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: -3,
            backgroundImage: staticPreviewUrl ? `url("${staticPreviewUrl}")` : 'none',
            backgroundColor: cssVars.bg2,
            backgroundSize: 'cover',
            backgroundPosition: 'center 45%',
            filter: 'saturate(0.9) brightness(0.45) hue-rotate(20deg) contrast(1.05)',
            transform: 'scale(1.05)',
            animation: 'bgBreath 20s ease-in-out infinite alternate',
          }}
        />

        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: -2,
            background: [
              'linear-gradient(180deg, oklch(0.09 0.008 55 / 0.5) 0%, oklch(0.09 0.008 55 / 0.2) 40%, oklch(0.09 0.008 55 / 0.95) 100%)',
              'radial-gradient(ellipse 70% 60% at 80% 30%, oklch(0.76 0.18 60 / 0.18), transparent 60%)',
            ].join(', '),
          }}
        />

        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: -1,
            backgroundImage: [
              'linear-gradient(to right, oklch(1 0 0 / 0.025) 1px, transparent 1px)',
              'linear-gradient(to bottom, oklch(1 0 0 / 0.025) 1px, transparent 1px)',
            ].join(', '),
            backgroundSize: '80px 80px',
            maskImage: 'radial-gradient(ellipse 80% 100% at 50% 50%, #000, transparent 85%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 100% at 50% 50%, #000, transparent 85%)',
            opacity: 0.5,
            pointerEvents: 'none',
          }}
        />

        {/* ── Hero Top ── */}
        <div style={{ maxWidth: 1240, margin: '0 auto', width: '100%' }}>
          {/* Breadcrumbs */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              color: cssVars.ink3,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            <a
              href="/explore"
              className="rh-crumb-link"
              style={{ color: cssVars.ink3, textDecoration: 'none', transition: 'color .2s' }}
            >
              Explore
            </a>
            <span style={{ color: cssVars.ink4 }}>/</span>
            <a
              href={`/explore/${country}`}
              className="rh-crumb-link"
              style={{ color: cssVars.ink3, textDecoration: 'none', transition: 'color .2s' }}
            >
              {countryName}
            </a>
            <span style={{ color: cssVars.ink4 }}>/</span>
            <a
              href={`/explore/${country}/${region}`}
              className="rh-crumb-link"
              style={{ color: cssVars.ink3, textDecoration: 'none', transition: 'color .2s' }}
            >
              {regionName}
            </a>
            <span style={{ color: cssVars.ink4 }}>/</span>
            <span style={{ color: cssVars.warm400 }}>{routeName}</span>
          </nav>

          {/* Meta tags row */}
          <div
            style={{
              marginTop: 36,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {/* Country flag tag */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                background: 'oklch(1 0 0 / 0.05)',
                border: `1px solid ${cssVars.line}`,
                borderRadius: 999,
                backdropFilter: 'blur(12px)',
                fontSize: 12,
                color: cssVars.ink2,
                fontWeight: 500,
                letterSpacing: '-0.005em',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 16,
                  borderRadius: 3,
                  background: 'oklch(0.4 0.18 265)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: 'oklch(0.98 0 0)',
                  letterSpacing: '0.05em',
                }}
              >
                {countryCode}
              </span>
              {countryName}
            </span>

            {/* Status dot tag */}
            {route.status && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  background: 'oklch(1 0 0 / 0.05)',
                  border: `1px solid ${cssVars.line}`,
                  borderRadius: 999,
                  backdropFilter: 'blur(12px)',
                  fontSize: 12,
                  color: cssVars.ink2,
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: cssVars.success,
                    boxShadow: `0 0 0 4px oklch(0.72 0.2 145 / 0.18)`,
                  }}
                />
                {route.status === 'published' ? 'Verified' : route.status}
              </span>
            )}

            {/* Editor's pick */}
            {route.isMotovaultPick && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  background: 'oklch(1 0 0 / 0.05)',
                  border: `1px solid ${cssVars.line}`,
                  borderRadius: 999,
                  backdropFilter: 'blur(12px)',
                  fontSize: 12,
                  color: cssVars.warm400,
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
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

            {/* Rating */}
            {route.ratingAvg != null && route.ratingCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  background: 'oklch(1 0 0 / 0.05)',
                  border: `1px solid ${cssVars.line}`,
                  borderRadius: 999,
                  backdropFilter: 'blur(12px)',
                  fontSize: 12,
                  color: cssVars.ink2,
                  fontWeight: 500,
                  letterSpacing: '-0.005em',
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill={cssVars.warm400}
                  aria-hidden="true"
                >
                  <title>Rating</title>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {route.ratingAvg.toFixed(1)} ({route.ratingCount})
              </span>
            )}
          </div>

          {/* Giant title */}
          <h1
            style={{
              margin: '28px 0 0',
              fontSize: 'clamp(64px, 10vw, 168px)',
              fontWeight: 500,
              lineHeight: 0.86,
              letterSpacing: '-0.05em',
            }}
          >
            {titleLines.map((line, i) => (
              <span key={line} style={{ display: 'block' }}>
                <span style={{ display: 'inline-block' }}>
                  {i === titleLines.length - 1 ? (
                    <span
                      style={{
                        fontFamily: "'Instrument Serif', serif",
                        fontWeight: 400,
                        fontStyle: 'italic',
                        letterSpacing: '-0.03em',
                        color: cssVars.warm300,
                      }}
                    >
                      {line}
                    </span>
                  ) : (
                    line
                  )}
                </span>
              </span>
            ))}
          </h1>
        </div>

        {/* ── Hero Bottom: Stats + Actions ── */}
        <div
          className="rh-bottom-grid"
          style={{
            maxWidth: 1240,
            margin: '60px auto 0',
            width: '100%',
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: 60,
            alignItems: 'end',
          }}
        >
          {/* Stats grid */}
          <div
            className="rh-stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 0,
              border: `1px solid ${cssVars.line}`,
              borderRadius: 16,
              overflow: 'hidden',
              background: 'oklch(0.09 0.008 55 / 0.6)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="rh-stat" style={{ padding: '18px 20px' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9.5,
                  color: cssVars.ink3,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                Distance
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDistance(route.distanceM)}
                <span
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: cssVars.warm400,
                    fontSize: 20,
                    marginLeft: 4,
                  }}
                >
                  km
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: cssVars.ink4,
                  letterSpacing: '-0.005em',
                }}
              >
                {surfaceLabel} road
              </div>
            </div>

            <div className="rh-stat" style={{ padding: '18px 20px' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9.5,
                  color: cssVars.ink3,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                Elevation
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {route.elevationGainM != null && route.elevationGainM > 0
                  ? formatElevation(route.elevationGainM)
                  : '--'}
                <span
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: cssVars.warm400,
                    fontSize: 20,
                    marginLeft: 4,
                  }}
                >
                  m
                </span>
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: cssVars.ink4,
                  letterSpacing: '-0.005em',
                }}
              >
                Elevation gain
              </div>
            </div>

            <div className="rh-stat" style={{ padding: '18px 20px' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9.5,
                  color: cssVars.ink3,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                Curvature
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  color: difficulty.color,
                }}
              >
                {difficulty.label}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: cssVars.ink4,
                  letterSpacing: '-0.005em',
                }}
              >
                {getCurvatureLabel(route.curvatureIndex)}
              </div>
            </div>

            <div className="rh-stat" style={{ padding: '18px 20px' }}>
              <div
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 9.5,
                  color: cssVars.ink3,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                Est. Time
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDuration(route.distanceM)}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: cssVars.ink4,
                  letterSpacing: '-0.005em',
                }}
              >
                Riding time
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className="rh-actions"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'flex-end',
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <GpxDownloadButton
                routeId={route.id}
                routeName={routeName}
                isAuthenticated={hasSession}
              />
              <OpenInAppCta />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <SaveRouteButton routeId={route.id} />
              <ShareButton routeName={routeName} variant="icon" />
            </div>

            {/* Contributor */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: cssVars.ink3,
                fontSize: 12,
                letterSpacing: '-0.005em',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, oklch(0.5 0.18 30), oklch(0.6 0.15 60))',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: cssVars.ink,
                  border: '1px solid oklch(1 0 0 / 0.2)',
                }}
              >
                {route.contributor.displayName.charAt(0).toUpperCase()}
              </div>
              <span>
                Added by{' '}
                <strong style={{ color: cssVars.ink2, fontWeight: 500 }}>
                  {route.contributor.publicUsername ? (
                    <a
                      href={`/u/${route.contributor.publicUsername}`}
                      style={{ color: cssVars.ink2, textDecoration: 'none' }}
                    >
                      {route.contributor.displayName}
                    </a>
                  ) : (
                    route.contributor.displayName
                  )}
                </strong>{' '}
                &middot;{' '}
                {new Date(route.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ OVERVIEW SECTION ═══════════════ */}
      {(editorialText || editorial) && (
        <section
          className="rsec-wrapper"
          style={{ padding: '100px 40px', maxWidth: 1240, margin: '0 auto' }}
        >
          <div style={{ marginBottom: 56 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: cssVars.ink3,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ width: 28, height: 1, background: cssVars.warm500 }} />
              Overview
            </div>
            <h2
              style={{
                fontSize: 'clamp(36px, 5vw, 64px)',
                fontWeight: 500,
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
                margin: '16px 0 0',
                maxWidth: 700,
              }}
            >
              About{' '}
              <span
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  fontStyle: 'italic',
                  letterSpacing: '-0.03em',
                  color: cssVars.warm400,
                }}
              >
                this route
              </span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 80 }}>
            <div>
              {editorialText && (
                <p
                  style={{
                    color: cssVars.ink2,
                    fontSize: 17,
                    lineHeight: 1.65,
                    letterSpacing: '-0.01em',
                    margin: 0,
                    maxWidth: '60ch',
                  }}
                >
                  {editorialText}
                </p>
              )}

              {editorial && (
                <div style={{ marginTop: editorialText ? 40 : 0 }}>
                  {editorial.introduction && !editorialText && (
                    <p
                      style={{
                        color: cssVars.ink2,
                        fontSize: 17,
                        lineHeight: 1.65,
                        letterSpacing: '-0.01em',
                        margin: '0 0 40px',
                        maxWidth: '60ch',
                      }}
                    >
                      {editorial.introduction}
                    </p>
                  )}
                  {editorial.sections.map((section) => (
                    <div key={section.heading} style={{ marginTop: 40 }}>
                      <h3
                        style={{
                          fontSize: 22,
                          fontWeight: 500,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.15,
                          margin: '0 0 14px',
                        }}
                      >
                        {section.heading}
                      </h3>
                      <p
                        style={{
                          color: cssVars.ink2,
                          fontSize: 15,
                          lineHeight: 1.7,
                          maxWidth: '60ch',
                          letterSpacing: '-0.005em',
                          margin: 0,
                        }}
                      >
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Condition Tags */}
              {topConditionTags.length > 0 && (
                <div style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {topConditionTags.map(([tag, count]) => (
                    <ConditionTagBadge key={tag} tag={tag} count={count} />
                  ))}
                </div>
              )}
            </div>

            {/* Side facts */}
            <div>
              <div
                style={{
                  background: cssVars.surface,
                  border: `1px solid ${cssVars.line}`,
                  borderRadius: 18,
                  padding: 22,
                }}
              >
                <h4
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 11,
                    color: cssVars.ink3,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    margin: '0 0 14px',
                    fontWeight: 500,
                  }}
                >
                  Quick Facts
                </h4>
                <div>
                  {[
                    { key: 'Region', value: regionName },
                    { key: 'Country', value: countryName },
                    { key: 'Surface', value: surfaceLabel },
                    { key: 'Difficulty', value: difficulty.label, color: difficulty.color },
                    ...(route.ratingAvg != null && route.ratingCount > 0
                      ? [
                          {
                            key: 'Rating',
                            value: `${route.ratingAvg.toFixed(1)} (${route.ratingCount})`,
                          },
                        ]
                      : []),
                  ].map((fact) => (
                    <div
                      key={fact.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        fontSize: 13,
                        borderBottom: `1px dashed oklch(1 0 0 / 0.03)`,
                      }}
                    >
                      <span style={{ color: cssVars.ink3, letterSpacing: '-0.005em' }}>
                        {fact.key}
                      </span>
                      <span
                        style={{
                          color: 'color' in fact && fact.color ? fact.color : cssVars.ink,
                          fontWeight: 500,
                          letterSpacing: '-0.005em',
                        }}
                      >
                        {fact.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FAQs */}
          {editorial && editorial.faqs.length > 0 && (
            <div
              style={{
                marginTop: 80,
                paddingTop: 80,
                borderTop: `1px solid ${cssVars.line}`,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 14,
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  color: cssVars.ink3,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ width: 28, height: 1, background: cssVars.warm500 }} />
                FAQ
              </div>
              <h2
                style={{
                  fontSize: 'clamp(36px, 5vw, 64px)',
                  fontWeight: 500,
                  lineHeight: 0.98,
                  letterSpacing: '-0.04em',
                  margin: '16px 0 56px',
                }}
              >
                Common{' '}
                <span
                  style={{
                    fontFamily: "'Instrument Serif', serif",
                    fontWeight: 400,
                    fontStyle: 'italic',
                    letterSpacing: '-0.03em',
                    color: cssVars.warm400,
                  }}
                >
                  questions
                </span>
              </h2>
              <dl
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                  border: `1px solid ${cssVars.line}`,
                  borderRadius: 24,
                  overflow: 'hidden',
                  background: cssVars.bg2,
                }}
              >
                {editorial.faqs.map((faq) => (
                  <div
                    key={faq.question}
                    style={{
                      padding: '28px 32px',
                      borderBottom: `1px solid ${cssVars.line}`,
                    }}
                  >
                    <dt
                      style={{
                        fontSize: 16,
                        fontWeight: 500,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {faq.question}
                    </dt>
                    <dd
                      style={{
                        marginTop: 10,
                        color: cssVars.ink2,
                        fontSize: 14.5,
                        lineHeight: 1.6,
                        letterSpacing: '-0.005em',
                        maxWidth: '60ch',
                      }}
                    >
                      {faq.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}

      {/* ═══════════════ MAP SECTION ═══════════════ */}
      <section
        className="rsec-wrapper"
        style={{ padding: '100px 40px', maxWidth: 1240, margin: '0 auto' }}
      >
        <div style={{ marginBottom: 56 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              fontFamily: "'Geist Mono', monospace",
              fontSize: 11,
              color: cssVars.ink3,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ width: 28, height: 1, background: cssVars.warm500 }} />
            Route Map
          </div>
          <h2
            style={{
              fontSize: 'clamp(36px, 5vw, 64px)',
              fontWeight: 500,
              lineHeight: 0.98,
              letterSpacing: '-0.04em',
              margin: '16px 0 0',
              maxWidth: 700,
            }}
          >
            Explore the{' '}
            <span
              style={{
                fontFamily: "'Instrument Serif', serif",
                fontWeight: 400,
                fontStyle: 'italic',
                letterSpacing: '-0.03em',
                color: cssVars.warm400,
              }}
            >
              terrain
            </span>
          </h2>
        </div>

        <div
          style={{
            border: `1px solid ${cssVars.line}`,
            borderRadius: 24,
            overflow: 'hidden',
            background: 'oklch(0.13 0.012 55)',
          }}
        >
          <RouteMapSection
            polyline={decodedPolyline}
            staticPreviewUrl={staticPreviewUrl}
            mapInstanceKey={route.id}
          />
        </div>
      </section>

      {/* ═══════════════ REVIEWS SECTION ═══════════════ */}
      {(reviews.length > 0 || totalReviewCount > 0) && (
        <section
          className="rsec-wrapper"
          style={{
            padding: '100px 40px',
            maxWidth: 1240,
            margin: '0 auto',
            borderTop: `1px solid ${cssVars.line}`,
          }}
        >
          <div style={{ marginBottom: 56 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 14,
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: cssVars.ink3,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ width: 28, height: 1, background: cssVars.warm500 }} />
              Reviews
            </div>
            <h2
              style={{
                fontSize: 'clamp(36px, 5vw, 64px)',
                fontWeight: 500,
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
                margin: '16px 0 0',
                maxWidth: 700,
              }}
            >
              Rider{' '}
              <span
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontWeight: 400,
                  fontStyle: 'italic',
                  letterSpacing: '-0.03em',
                  color: cssVars.warm400,
                }}
              >
                experiences
              </span>
            </h2>
          </div>

          <RouteDetailReviewsSection
            reviews={reviews}
            totalCount={totalReviewCount}
            hasMore={hasMoreReviews}
            isAuthenticated={hasSession}
            ratingAvg={route.ratingAvg ?? null}
          />
        </section>
      )}
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        padding: '6px 14px',
        fontSize: 13,
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${cssVars.line}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      {tag}
      {count > 1 && <span style={{ fontSize: 11, opacity: 0.6 }}>&times;{count}</span>}
    </span>
  );
}
