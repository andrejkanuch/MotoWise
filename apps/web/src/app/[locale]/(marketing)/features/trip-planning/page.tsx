import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { TripPlanningFaq } from './trip-planning-faq';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

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
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--mv-ink-3)',
            marginBottom: 40,
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
          <span style={{ color: 'var(--mv-ink)' }}>{t('title')}</span>
        </nav>

        <div className="mv-grid-hero">
          {/* Text column */}
          <div>
            <h1
              className="mv-display"
              style={{
                fontSize: 'clamp(48px, 7vw, 104px)',
                fontWeight: 700,
                lineHeight: 0.94,
                margin: 0,
              }}
            >
              <span style={{ display: 'block' }}>{t('heroHeading1')}</span>
              <span style={{ display: 'block' }}>{t('heroHeading2')}</span>
            </h1>
            <p
              style={{
                marginTop: 28,
                color: 'var(--mv-ink-2)',
                fontSize: 18,
                lineHeight: 1.55,
                maxWidth: 520,
                letterSpacing: '-0.01em',
              }}
            >
              {t('heroSubtitle')}
            </p>
            <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/#download" className="mv-btn mv-btn-primary">
                <span>{t('heroCta')}</span>
                <ArrowIcon />
              </Link>
              <a href="#how" className="mv-btn mv-btn-ghost">
                {t('heroCtaHow')}
              </a>
            </div>
          </div>

          {/* Visual column — route map, an app depiction on a solid surface */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4/3',
                maxWidth: 600,
                borderRadius: 'var(--mv-radius-plate)',
                overflow: 'hidden',
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
              }}
            >
              <svg
                viewBox="0 0 600 450"
                fill="none"
                style={{ width: '100%', height: '100%' }}
                aria-hidden="true"
              >
                <path
                  d="M 80 380 Q 160 320 200 280 T 320 220 Q 380 170 430 140 T 520 80"
                  stroke="var(--mv-info)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.2"
                />
                <path
                  d="M 80 380 Q 160 320 200 280 T 320 220 Q 380 170 430 140 T 520 80"
                  stroke="var(--mv-info)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {/* Start waypoint */}
                <circle cx="80" cy="380" r="7" fill="var(--mv-go)" />
                <circle cx="80" cy="380" r="3" fill="var(--mv-surface)" />
                {/* Mid waypoints */}
                <circle cx="200" cy="280" r="6" fill="var(--mv-ink-2)" />
                <circle cx="200" cy="280" r="2.5" fill="var(--mv-surface)" />
                <text x="215" y="275" fontSize="11" fontWeight="500" fill="var(--mv-ink-3)">
                  Fuel
                </text>
                <circle cx="320" cy="220" r="6" fill="var(--mv-ink-2)" />
                <circle cx="320" cy="220" r="2.5" fill="var(--mv-surface)" />
                <text x="335" y="215" fontSize="11" fontWeight="500" fill="var(--mv-ink-3)">
                  Scenic
                </text>
                <circle cx="430" cy="140" r="6" fill="var(--mv-ink-2)" />
                <circle cx="430" cy="140" r="2.5" fill="var(--mv-surface)" />
                <text x="445" y="135" fontSize="11" fontWeight="500" fill="var(--mv-ink-3)">
                  Pass
                </text>
                {/* End waypoint */}
                <circle cx="520" cy="80" r="7" fill="var(--mv-ink)" />
                <circle cx="520" cy="80" r="3" fill="var(--mv-surface)" />
              </svg>

              {/* Route info overlay — a raised ramp step, no blur */}
              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  background: 'var(--mv-surface-2)',
                  border: '1px solid var(--mv-line)',
                  borderRadius: 'var(--mv-radius-card)',
                  padding: '14px 16px',
                  minWidth: 200,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mv-ink-3)' }}>
                  {t('routeLabel')}
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    marginTop: 4,
                    letterSpacing: '-0.01em',
                    color: 'var(--mv-ink)',
                  }}
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
                    <strong
                      className="mv-figure"
                      style={{ color: 'var(--mv-ink)', fontSize: 14, display: 'block' }}
                    >
                      {t('routeDistance')}
                    </strong>
                    {t('routeDistanceLabel')}
                  </div>
                  <div>
                    <strong
                      className="mv-figure"
                      style={{ color: 'var(--mv-ink)', fontSize: 14, display: 'block' }}
                    >
                      {t('routeRiding')}
                    </strong>
                    {t('routeRidingLabel')}
                  </div>
                  <div>
                    <strong
                      className="mv-figure"
                      style={{ color: 'var(--mv-ink)', fontSize: 14, display: 'block' }}
                    >
                      {t('routeStops')}
                    </strong>
                    {t('routeStopsLabel')}
                  </div>
                </div>
              </div>

              {/* GPX exported badge — app status, solid chip */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  background: 'var(--mv-surface-2)',
                  border: '1px solid var(--mv-line)',
                  borderRadius: 999,
                  padding: '8px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--mv-go)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--mv-go)',
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
          <h2 className="mv-section-title">
            {t('howTitle')} <span className="mv-muted">{t('howTitleSerif')}</span>
          </h2>
        </div>

        <div className="mv-grid-3" style={{ marginTop: 72, columnGap: 48, rowGap: 56 }}>
          {([1, 2, 3, 4, 5, 6] as const)
            .map((i) => ({
              num: `0${i}`,
              title: t(`pillar${i}Title`),
              body: t(`pillar${i}Body`),
              kvLabel: t(`pillar${i}KvLabel`),
              kvValue: t(`pillar${i}KvValue`),
            }))
            .map((p) => (
              <div key={p.num}>
                <div className="mv-figure" style={{ fontSize: 18, color: 'var(--mv-ink-4)' }}>
                  {p.num}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    letterSpacing: '-0.005em',
                    lineHeight: 1.25,
                    margin: '20px 0 10px',
                    color: 'var(--mv-ink)',
                  }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    color: 'var(--mv-ink-2)',
                    fontSize: 15,
                    lineHeight: 1.6,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {p.body}
                </div>
                <div
                  style={{
                    marginTop: 18,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: 12,
                    fontSize: 13,
                    color: 'var(--mv-ink-3)',
                  }}
                >
                  {p.kvLabel}
                  <strong className="mv-figure" style={{ fontSize: 18, color: 'var(--mv-ink)' }}>
                    {p.kvValue}
                  </strong>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* ════ SHOWCASE 1 — Waypoints ════ */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div className="mv-section-inner">
          <div className="mv-grid-2">
            <div>
              <h3
                className="mv-display"
                style={{
                  fontSize: 'clamp(32px, 3.8vw, 54px)',
                  fontWeight: 700,
                  lineHeight: 1,
                  margin: 0,
                }}
              >
                {t('waypointsTitle')} {t('waypointsTitleSerif')}
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
              {/* Waypoint types — list on the band, no icon tiles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  columnGap: 40,
                  rowGap: 0,
                  marginTop: 48,
                }}
              >
                {[
                  { label: t('wp1Label'), sub: t('wp1Sub') },
                  { label: t('wp2Label'), sub: t('wp2Sub') },
                  { label: t('wp3Label'), sub: t('wp3Sub') },
                  { label: t('wp4Label'), sub: t('wp4Sub') },
                ].map((wp) => (
                  <div
                    key={wp.label}
                    style={{ borderTop: '1px solid var(--mv-line)', padding: '18px 0' }}
                  >
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        letterSpacing: '-0.005em',
                        color: 'var(--mv-ink)',
                      }}
                    >
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
            {/* Phone mockup — the one full device frame on this page */}
            <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
              <div className="mv-phone-mockup">
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 35,
                    overflow: 'hidden',
                    background: 'var(--mv-surface)',
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
        </div>
      </section>

      {/* ════ SHOWCASE 2 — Export & share (reversed) ════ */}
      <section className="mv-section-inner">
        <div className="mv-grid-2-rev">
          <div>
            <h3
              className="mv-display"
              style={{
                fontSize: 'clamp(32px, 3.8vw, 54px)',
                fontWeight: 700,
                lineHeight: 1,
                margin: 0,
              }}
            >
              {t('exportTitle')} {t('exportTitleSerif')}
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
                      gap: 12,
                      alignItems: 'flex-start',
                      fontSize: 15,
                      color: 'var(--mv-ink-2)',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--mv-ink-3)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flexShrink: 0, marginTop: 3 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {item}
                  </div>
                ),
              )}
            </div>
            {/* Export formats */}
            <div
              style={{
                marginTop: 40,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {['GPX', 'KML', 'GeoJSON', 'Apple Maps', 'Google Maps', 'Garmin', 'Rever'].map(
                (chip) => (
                  <span
                    key={chip}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 14px',
                      background: 'var(--mv-surface)',
                      border: '1px solid var(--mv-line)',
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--mv-ink-2)',
                    }}
                  >
                    {chip}
                  </span>
                ),
              )}
            </div>
          </div>
          {/* Screenshot — cropped on a surface panel (no second device frame) */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 420,
                aspectRatio: '4/5',
                borderRadius: 'var(--mv-radius-card)',
                overflow: 'hidden',
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
              }}
            >
              <Image
                src="/images/marketing/mw/trip-detail-hero.png"
                alt="MotoVault trip detail showing Dolomites route overview"
                fill
                style={{ objectFit: 'cover', objectPosition: 'top' }}
                sizes="420px"
              />
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
                className="mv-figure"
                style={{
                  fontSize: 'clamp(32px, 3.6vw, 52px)',
                  lineHeight: 1,
                  color: 'var(--mv-ink)',
                }}
              >
                {s.value}
                <span style={{ color: 'var(--mv-ink-3)' }}>{s.unit}</span>
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
      <section className="mv-section-cta" style={{ background: 'var(--mv-bg-2)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="mv-section-title" style={{ textAlign: 'center' }}>
            {t('ctaSectionTitle')} {t('ctaSectionTitleSerif')}
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

      {/* ════ NEXT FEATURES ════ */}
      <section className="mv-section-nav">
        <div className="mv-grid-cards" style={{ columnGap: 80, rowGap: 0 }}>
          {[
            {
              href: '/features/ai-diagnostics' as const,
              title: `${t('nextFeature1Title')} ${t('nextFeature1Serif')}`,
              sub: t('nextFeature1Sub'),
            },
            {
              href: '/features/garage-management' as const,
              title: `${t('nextFeature2Title')} ${t('nextFeature2Serif')}`,
              sub: t('nextFeature2Sub'),
            },
          ].map((next) => (
            <Link
              key={next.href}
              href={next.href}
              style={{
                display: 'block',
                padding: '32px 0',
                borderTop: '1px solid var(--mv-line)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                className="mv-display"
                style={{
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  fontWeight: 600,
                  lineHeight: 1,
                  color: 'var(--mv-ink)',
                }}
              >
                {next.title}
              </div>
              <div
                style={{
                  marginTop: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  color: 'var(--mv-copper-text)',
                  fontWeight: 500,
                }}
              >
                {next.sub}
                <ArrowIcon />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
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
