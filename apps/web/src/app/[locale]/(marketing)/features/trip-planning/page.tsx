import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { TripPlanningFaq } from './trip-planning-faq';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesTripPlanning');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/trip-planning'),
      languages: getHreflangMap('/features/trip-planning'),
    },
  };
}

/* ── Arrow icon shared across buttons ── */
function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export default async function TripPlanningPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesTripPlanning');

  const canonical = getCanonicalUrl(locale, '/features/trip-planning');

  const faqItems = [0, 1, 2, 3, 4, 5].map((i) => ({
    question: t(`faq${i}Question`),
    answer: t(`faq${i}Answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/features/trip-planning',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Features', url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features/trip-planning',
    ),
    buildFAQPage(faqItems, `${locale}/features/trip-planning/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* ════ HERO ════ */}
      <section
        className="mv-section-hero"
        style={{
          position: 'relative',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
        }}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
            fontSize: 11,
            color: 'var(--mv-ink-3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          <Link href="/" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
            MotoVault
          </Link>
          <span style={{ color: 'var(--mv-ink-4)' }}>/</span>
          <Link href="/features" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
            Features
          </Link>
          <span style={{ color: 'var(--mv-ink-4)' }}>/</span>
          <span style={{ color: 'var(--mv-warm-400)' }}>{t('title')}</span>
        </nav>

        <div className="mv-grid-hero">
          {/* Text column */}
          <div>
            <div className="mv-section-meta">{t('heroMeta')}</div>
            <h1
              style={{
                fontSize: 'clamp(48px, 7.5vw, 112px)',
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: '-0.045em',
                margin: '24px 0 0',
              }}
            >
              <span style={{ display: 'block' }}>{t('heroHeading1')}</span>
              <span style={{ display: 'block' }}>
                <em className="mv-serif">{t('heroHeading2')}</em>
              </span>
            </h1>
            <p
              style={{
                marginTop: 32,
                color: 'var(--mv-ink-2)',
                fontSize: 18,
                lineHeight: 1.55,
                maxWidth: 520,
                letterSpacing: '-0.01em',
              }}
            >
              {t('heroSubtitle')}
            </p>
            <div style={{ marginTop: 40, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/#download" className="mv-btn mv-btn-primary">
                <span>{t('heroCta')}</span>
                <ArrowIcon />
              </Link>
              <a href="#how" className="mv-btn mv-btn-ghost">
                {t('heroCtaHow')}
              </a>
            </div>
          </div>

          {/* Visual column — animated route map */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                maxWidth: 600,
                borderRadius: 24,
                overflow: 'hidden',
                background:
                  'radial-gradient(circle at 30% 30%, oklch(0.2 0.015 55), oklch(0.1 0.008 55))',
                border: '1px solid var(--mv-line)',
                boxShadow: '0 40px 80px -20px oklch(0 0 0 / 0.6)',
              }}
            >
              {/* Grid overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage:
                    'linear-gradient(to right, oklch(1 0 0 / 0.03) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.03) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                  maskImage: 'radial-gradient(ellipse 80% 90% at 50% 50%, black, transparent 90%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 80% 90% at 50% 50%, black, transparent 90%)',
                }}
              />
              <svg
                viewBox="0 0 600 450"
                fill="none"
                style={{ width: '100%', height: '100%' }}
                aria-hidden="true"
              >
                <path
                  d="M 80 380 Q 160 320 200 280 T 320 220 Q 380 170 430 140 T 520 80"
                  stroke="oklch(0.84 0.15 68)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.2"
                />
                <path
                  d="M 80 380 Q 160 320 200 280 T 320 220 Q 380 170 430 140 T 520 80"
                  stroke="oklch(0.84 0.15 68)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* Start waypoint */}
                <circle cx="80" cy="380" r="7" fill="oklch(0.72 0.2 145)" />
                <circle cx="80" cy="380" r="3" fill="var(--mv-bg)" />
                {/* Mid waypoints */}
                <circle cx="200" cy="280" r="6" fill="oklch(0.84 0.15 68)" />
                <circle cx="200" cy="280" r="2.5" fill="var(--mv-bg)" />
                <text
                  x="215"
                  y="275"
                  fontFamily="Geist Mono, monospace"
                  fontSize="10"
                  fill="oklch(0.78 0.012 70)"
                  letterSpacing="0.05em"
                >
                  FUEL
                </text>
                <circle cx="320" cy="220" r="6" fill="oklch(0.84 0.15 68)" />
                <circle cx="320" cy="220" r="2.5" fill="var(--mv-bg)" />
                <text
                  x="335"
                  y="215"
                  fontFamily="Geist Mono, monospace"
                  fontSize="10"
                  fill="oklch(0.78 0.012 70)"
                  letterSpacing="0.05em"
                >
                  SCENIC
                </text>
                <circle cx="430" cy="140" r="6" fill="oklch(0.84 0.15 68)" />
                <circle cx="430" cy="140" r="2.5" fill="var(--mv-bg)" />
                <text
                  x="445"
                  y="135"
                  fontFamily="Geist Mono, monospace"
                  fontSize="10"
                  fill="oklch(0.78 0.012 70)"
                  letterSpacing="0.05em"
                >
                  PASS
                </text>
                {/* End waypoint */}
                <circle cx="520" cy="80" r="7" fill="oklch(0.76 0.18 60)" />
                <circle cx="520" cy="80" r="3" fill="var(--mv-bg)" />
              </svg>

              {/* Route info overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  background: 'oklch(0.12 0.01 55 / 0.85)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--mv-line)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  minWidth: 200,
                }}
              >
                <div
                  className="mv-mono"
                  style={{
                    fontSize: 10,
                    color: 'var(--mv-warm-400)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('routeLabel')}
                </div>
                <div
                  style={{ fontSize: 15, fontWeight: 500, marginTop: 4, letterSpacing: '-0.01em' }}
                >
                  {t('routeName')}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--mv-line)',
                    fontSize: 12,
                    color: 'var(--mv-ink-3)',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--mv-ink)', fontWeight: 500, display: 'block' }}>
                      {t('routeDistance')}
                    </strong>
                    {t('routeDistanceLabel')}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--mv-ink)', fontWeight: 500, display: 'block' }}>
                      {t('routeRiding')}
                    </strong>
                    {t('routeRidingLabel')}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--mv-ink)', fontWeight: 500, display: 'block' }}>
                      {t('routeStops')}
                    </strong>
                    {t('routeStopsLabel')}
                  </div>
                </div>
              </div>

              {/* GPX exported badge */}
              <div
                className="mv-mono"
                style={{
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  background: 'oklch(0.72 0.2 145 / 0.15)',
                  border: '1px solid oklch(0.72 0.2 145 / 0.4)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 999,
                  padding: '8px 14px 8px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--mv-success)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--mv-success)',
                    boxShadow: '0 0 8px var(--mv-success)',
                  }}
                />
                {t('gpxBadge')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ PILLARS — How it works ════ */}
      <section id="how" className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">{t('howLabel')}</div>
          <h2 className="mv-section-title">
            {t('howTitle')} <span className="mv-serif">{t('howTitleSerif')}</span>
          </h2>
        </div>

        <div
          className="mv-grid-3"
          style={{
            marginTop: 80,
            gap: 2,
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          {([1, 2, 3, 4, 5, 6] as const)
            .map((i) => ({
              num: `0${i}`,
              title: t(`pillar${i}Title`),
              body: t(`pillar${i}Body`),
              kvLabel: t(`pillar${i}KvLabel`),
              kvValue: t(`pillar${i}KvValue`),
            }))
            .map((p) => (
              <div
                key={p.num}
                style={{
                  background: 'var(--mv-bg)',
                  padding: 40,
                  minHeight: 260,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  className="mv-mono"
                  style={{ fontSize: 11, color: 'var(--mv-warm-400)', letterSpacing: '0.15em' }}
                >
                  {p.num}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                    margin: '32px 0 14px',
                  }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    color: 'var(--mv-ink-3)',
                    fontSize: 14,
                    lineHeight: 1.55,
                    letterSpacing: '-0.005em',
                    flex: 1,
                  }}
                >
                  {p.body}
                </div>
                <div
                  className="mv-mono"
                  style={{
                    marginTop: 24,
                    paddingTop: 24,
                    borderTop: '1px solid var(--mv-line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 11,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  {p.kvLabel}
                  <strong
                    style={{
                      fontFamily: "var(--font-geist, 'Geist', sans-serif)",
                      fontSize: 14,
                      color: 'var(--mv-warm-400)',
                      fontWeight: 500,
                      textTransform: 'none',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {p.kvValue}
                  </strong>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* ════ SHOWCASE 1 — Waypoints ════ */}
      <section className="mv-section-inner">
        <div className="mv-grid-2">
          <div>
            <div
              className="mv-mono"
              style={{
                fontSize: 11,
                color: 'var(--mv-warm-400)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              {t('waypointsLabel')}
            </div>
            <h3
              style={{
                fontSize: 'clamp(32px, 3.8vw, 54px)',
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: '-0.035em',
                margin: '18px 0 0',
              }}
            >
              {t('waypointsTitle')} <span className="mv-serif">{t('waypointsTitleSerif')}</span>
            </h3>
            <p
              style={{
                marginTop: 20,
                color: 'var(--mv-ink-2)',
                fontSize: 16,
                lineHeight: 1.6,
                maxWidth: 500,
                letterSpacing: '-0.005em',
              }}
            >
              {t('waypointsBody')}
            </p>
            {/* Waypoint type cards */}
            <div
              className="mv-grid-4"
              style={{
                gap: 16,
                marginTop: 60,
              }}
            >
              {[
                {
                  icon: 'M3 22h12 M5 22V4a2 2 0 012-2h4a2 2 0 012 2v18 M3 10h10 M17 5l3 3v9a2 2 0 01-2 2',
                  label: t('wp1Label'),
                  sub: t('wp1Sub'),
                },
                {
                  icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z',
                  label: t('wp2Label'),
                  sub: t('wp2Sub'),
                },
                {
                  icon: 'M2 4v16 M2 8h18a2 2 0 012 2v10 M2 17h20 M6 8v9',
                  label: t('wp3Label'),
                  sub: t('wp3Sub'),
                },
                {
                  icon: 'M12 2L22 22H2L12 2z',
                  label: t('wp4Label'),
                  sub: t('wp4Sub'),
                },
              ].map((wp) => (
                <div
                  key={wp.label}
                  style={{
                    background: 'var(--mv-surface)',
                    border: '1px solid var(--mv-line)',
                    borderRadius: 16,
                    padding: 24,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'oklch(1 0 0 / 0.04)',
                      border: '1px solid var(--mv-line)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--mv-warm-400)',
                      marginBottom: 24,
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d={wp.icon} />
                    </svg>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>
                    {wp.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--mv-ink-3)',
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    {wp.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Phone mockup */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-40px -20px',
                background:
                  'radial-gradient(ellipse 50% 50% at 50% 50%, var(--mv-warm-900), transparent 70%)',
                filter: 'blur(60px)',
                opacity: 0.55,
                zIndex: 0,
              }}
              aria-hidden="true"
            />
            <div className="mv-phone-mockup">
              {/* Dynamic island */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 110,
                  height: 28,
                  background: '#000',
                  borderRadius: 999,
                  zIndex: 3,
                }}
                aria-hidden="true"
              />
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 35,
                  overflow: 'hidden',
                  background: '#111',
                }}
              >
                <Image
                  src="/images/marketing/mw/trip-planning-new.png"
                  alt="MotoVault trip planner showing a new route on a dark map"
                  width={640}
                  height={1386}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                  }}
                  sizes="320px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ SHOWCASE 2 — Export & share (reversed) ════ */}
      <section className="mv-section-inner">
        <div className="mv-grid-2-rev">
          <div>
            <div
              className="mv-mono"
              style={{
                fontSize: 11,
                color: 'var(--mv-warm-400)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              {t('exportLabel')}
            </div>
            <h3
              style={{
                fontSize: 'clamp(32px, 3.8vw, 54px)',
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: '-0.035em',
                margin: '18px 0 0',
              }}
            >
              {t('exportTitle')} <span className="mv-serif">{t('exportTitleSerif')}</span>
            </h3>
            <p
              style={{
                marginTop: 20,
                color: 'var(--mv-ink-2)',
                fontSize: 16,
                lineHeight: 1.6,
                maxWidth: 500,
                letterSpacing: '-0.005em',
              }}
            >
              {t('exportBody')}
            </p>
            {/* Checklist */}
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[t('exportCheck1'), t('exportCheck2'), t('exportCheck3'), t('exportCheck4')].map(
                (item) => (
                  <div
                    key={item}
                    style={{
                      display: 'flex',
                      gap: 14,
                      alignItems: 'flex-start',
                      fontSize: 14,
                      color: 'var(--mv-ink-2)',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: 'oklch(0.76 0.18 60 / 0.18)',
                        border: '1px solid var(--mv-warm-500)',
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23e9a76a' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'center',
                        marginTop: 2,
                      }}
                      aria-hidden="true"
                    />
                    {item}
                  </div>
                ),
              )}
            </div>
            {/* Export chips */}
            <div
              style={{
                marginTop: 40,
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                padding: 20,
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
                borderRadius: 14,
              }}
            >
              {['GPX', 'KML', 'GeoJSON', 'APPLE MAPS', 'GOOGLE MAPS', 'GARMIN', 'REVER'].map(
                (chip) => (
                  <span
                    key={chip}
                    className="mv-mono"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 14px',
                      background: 'oklch(1 0 0 / 0.03)',
                      border: '1px solid var(--mv-line)',
                      borderRadius: 999,
                      fontSize: 12,
                      color: 'var(--mv-ink-2)',
                      letterSpacing: '0.02em',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--mv-warm-500)',
                      }}
                    />
                    {chip}
                  </span>
                ),
              )}
            </div>
          </div>
          {/* Phone mockup */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-40px -20px',
                background:
                  'radial-gradient(ellipse 50% 50% at 50% 50%, var(--mv-warm-900), transparent 70%)',
                filter: 'blur(60px)',
                opacity: 0.55,
                zIndex: 0,
              }}
              aria-hidden="true"
            />
            <div className="mv-phone-mockup">
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 110,
                  height: 28,
                  background: '#000',
                  borderRadius: 999,
                  zIndex: 3,
                }}
                aria-hidden="true"
              />
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 35,
                  overflow: 'hidden',
                  background: '#111',
                }}
              >
                <Image
                  src="/images/marketing/mw/trip-detail-hero.png"
                  alt="MotoVault trip detail showing Dolomites route overview"
                  width={640}
                  height={1386}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                  }}
                  sizes="320px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ STATS ROW ════ */}
      <section className="mv-section-stats mv-grid-stats">
        {([1, 2, 3, 4] as const)
          .map((i) => ({
            value: t(`inlineStatValue${i}`),
            unit: t(`inlineStatUnit${i}`),
            label: t(`inlineStatLabel${i}`),
          }))
          .map((s) => (
            <div key={s.label} style={{ borderLeft: '1px solid var(--mv-line)', paddingLeft: 24 }}>
              <div
                style={{
                  fontSize: 'clamp(32px, 3.6vw, 52px)',
                  fontWeight: 500,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  color: 'var(--mv-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.value}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {s.unit}
                </span>
              </div>
              <div
                style={{
                  marginTop: 12,
                  color: 'var(--mv-ink-3)',
                  fontSize: 13,
                  letterSpacing: '-0.005em',
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
      </section>

      {/* ════ CTA ════ */}
      <section className="mv-section-cta">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 80% at 50% 50%, oklch(0.76 0.18 60 / 0.16), transparent 70%), linear-gradient(180deg, oklch(0.09 0.008 55 / 0.7), oklch(0.09 0.008 55 / 0.95))',
            zIndex: -1,
          }}
          aria-hidden="true"
        />
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div className="mv-section-meta" style={{ justifyContent: 'center' }}>
            {t('ctaLabel')}
          </div>
          <h2 className="mv-section-title" style={{ textAlign: 'center' }}>
            {t('ctaSectionTitle')}{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              {t('ctaSectionTitleSerif')}
            </span>
          </h2>
          <p
            style={{
              margin: '24px auto 0',
              maxWidth: 460,
              fontSize: 17,
              color: 'var(--mv-ink-2)',
              lineHeight: 1.55,
              letterSpacing: '-0.01em',
            }}
          >
            {t('ctaSubtitle')}
          </p>
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/#download" className="mv-btn mv-btn-primary">
              <span>{t('ctaCta')}</span>
            </Link>
            <Link href="/explore" className="mv-btn mv-btn-ghost">
              {t('ctaCtaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* ════ NEXT FEATURE CARDS ════ */}
      <section className="mv-section-nav">
        <div
          className="mv-grid-cards"
          style={{
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          <Link
            href="/features/ai-diagnostics"
            style={{
              background: 'var(--mv-bg)',
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 260,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div
                className="mv-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                {t('nextFeature1Label')}
              </div>
              <div
                style={{
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginTop: 16,
                }}
              >
                {t('nextFeature1Title')}{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {t('nextFeature1Serif')}
                </span>
              </div>
            </div>
            <div
              style={{
                marginTop: 32,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                color: 'var(--mv-warm-400)',
                fontWeight: 500,
              }}
            >
              {t('nextFeature1Sub')}
              <ArrowIcon />
            </div>
          </Link>
          <Link
            href="/features/garage-management"
            style={{
              background: 'var(--mv-bg)',
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 260,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div
                className="mv-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                {t('nextFeature2Label')}
              </div>
              <div
                style={{
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginTop: 16,
                }}
              >
                {t('nextFeature2Title')}{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {t('nextFeature2Serif')}
                </span>
              </div>
            </div>
            <div
              style={{
                marginTop: 32,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                color: 'var(--mv-warm-400)',
                fontWeight: 500,
              }}
            >
              {t('nextFeature2Sub')}
              <ArrowIcon />
            </div>
          </Link>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="mv-section-meta">{t('faqLabel')}</div>
          <h2 className="mv-section-title">{t('faqTitle')}</h2>
          <div style={{ marginTop: 48 }}>
            <TripPlanningFaq items={faqItems} />
          </div>
        </div>
      </section>

      {/* ════ BOTTOM CTA ════ */}
      <FeatureCta />
    </>
  );
}
