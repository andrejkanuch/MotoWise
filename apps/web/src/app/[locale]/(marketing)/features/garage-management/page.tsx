import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { GarageManagementFaq } from './faq';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/garage-management'),
      languages: getHreflangMap('/features/garage-management'),
    },
  };
}

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

const BIKE_VISUALS = [
  {
    abbr: 'MT',
    nameKey: 'bike1Name',
    subKey: 'bike1Sub',
    statusKey: 'bike1Status',
    statusWarn: false,
    bg: 'linear-gradient(135deg, oklch(0.7 0.2 40), oklch(0.35 0.12 30))',
    hasMeta: false,
  },
  {
    abbr: 'GS',
    nameKey: 'bike2Name',
    subKey: 'bike2Sub',
    statusKey: 'bike2Status',
    statusWarn: true,
    bg: 'linear-gradient(135deg, oklch(0.75 0.18 240), oklch(0.3 0.12 240))',
    hasMeta: true,
  },
  {
    abbr: 'SV',
    nameKey: 'bike3Name',
    subKey: 'bike3Sub',
    statusKey: 'bike3Status',
    statusWarn: false,
    bg: 'linear-gradient(135deg, oklch(0.8 0.15 110), oklch(0.35 0.1 120))',
    hasMeta: false,
  },
  {
    abbr: 'GR',
    nameKey: 'bike4Name',
    subKey: 'bike4Sub',
    statusKey: 'bike4Status',
    statusWarn: false,
    bg: 'linear-gradient(135deg, oklch(0.72 0.14 340), oklch(0.3 0.09 340))',
    hasMeta: false,
  },
] as const;

const CARD_POSITIONS = [
  { top: 0, transform: 'rotate(-2.5deg) translateX(-12px) scale(0.94)', zIndex: 1, opacity: 0.82 },
  { top: 74, transform: 'rotate(1.5deg)', zIndex: 3, opacity: 1 },
  { top: 150, transform: 'rotate(-1deg) translateX(8px) scale(0.97)', zIndex: 2, opacity: 0.93 },
  { top: 240, transform: 'rotate(2deg) translateX(-6px) scale(0.92)', zIndex: 1, opacity: 0.78 },
] as const;

const MAINT_ROW_VISUALS = [
  {
    icon: 'M12 2v6 M5 10h14 M7 10v10a2 2 0 002 2h6a2 2 0 002-2V10',
    labelKey: 'maint1Label',
    subKey: 'maint1Sub',
    dateKey: 'maint1Date',
    milesKey: 'maint1Miles',
    statusKey: 'maint1Status',
    statusType: 'done',
  },
  {
    icon: 'M12 12m-8 0a8 8 0 1016 0 8 8 0 10-16 0 M12 4v4 M12 16v4 M4 12h4 M16 12h4',
    labelKey: 'maint2Label',
    subKey: 'maint2Sub',
    dateKey: 'maint2Date',
    milesKey: 'maint2Miles',
    statusKey: 'maint2Status',
    statusType: 'due',
  },
  {
    icon: 'M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0 M12 12m-4 0a4 4 0 108 0 4 4 0 10-8 0',
    labelKey: 'maint3Label',
    subKey: 'maint3Sub',
    dateKey: 'maint3Date',
    milesKey: 'maint3Miles',
    statusKey: 'maint3Status',
    statusType: 'done',
  },
  {
    icon: 'M5 5h14v14H5z M9 9l6 6',
    labelKey: 'maint4Label',
    subKey: 'maint4Sub',
    dateKey: 'maint4Date',
    milesKey: 'maint4Miles',
    statusKey: 'maint4Status',
    statusType: 'wait',
  },
  {
    icon: 'M4 12h16 M4 6h16 M4 18h16',
    labelKey: 'maint5Label',
    subKey: 'maint5Sub',
    dateKey: 'maint5Date',
    milesKey: 'maint5Miles',
    statusKey: 'maint5Status',
    statusType: 'done',
  },
] as const;

export default async function GarageManagementPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');

  const canonical = getCanonicalUrl(locale, '/features/garage-management');

  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/features/garage-management',
    }),
    buildBreadcrumbList(
      [
        { name: t('breadcrumbHome'), url: getCanonicalUrl(locale) },
        { name: t('breadcrumbFeatures'), url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features/garage-management',
    ),
    buildFAQPage(faqItems, `${locale}/features/garage-management/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* ════ HERO ════ */}
      <section
        className="mv-section-hero"
        style={{
          position: 'relative',
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
            {t('breadcrumbFeatures')}
          </Link>
          <span style={{ color: 'var(--mv-ink-4)' }}>/</span>
          <span style={{ color: 'var(--mv-warm-400)' }}>{t('title')}</span>
        </nav>

        <div className="mv-grid-hero">
          {/* Text column */}
          <div>
            <div className="mv-section-meta">{t('heroLabel')}</div>
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
              <a href="#maint" className="mv-btn mv-btn-ghost">
                {t('heroCtaSecondary')}
              </a>
            </div>
          </div>

          {/* Garage stack visual */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{ position: 'relative', width: '100%', maxWidth: 520, aspectRatio: '4/4.3' }}
            >
              {BIKE_VISUALS.map((bike, i) => {
                const pos = CARD_POSITIONS[i];
                return (
                  <div
                    key={bike.abbr}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      background:
                        'linear-gradient(145deg, oklch(0.18 0.015 55), oklch(0.12 0.01 55))',
                      border: '1px solid var(--mv-line)',
                      borderRadius: 22,
                      padding: '22px 24px',
                      boxShadow: '0 30px 60px -20px oklch(0 0 0 / 0.7)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      top: pos.top,
                      transform: pos.transform,
                      zIndex: pos.zIndex,
                      opacity: pos.opacity,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 12,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          background: bike.bg,
                          color: '#000',
                          fontWeight: 600,
                          fontSize: 11,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {bike.abbr}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 500,
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {t(bike.nameKey)}
                        </div>
                        <div
                          className="mv-mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--mv-ink-3)',
                            marginTop: 4,
                            letterSpacing: '0.05em',
                          }}
                        >
                          {t(bike.subKey)}
                        </div>
                      </div>
                      <div
                        className="mv-mono"
                        style={{
                          padding: '5px 10px',
                          borderRadius: 999,
                          background: bike.statusWarn
                            ? 'oklch(0.76 0.18 60 / 0.15)'
                            : 'oklch(0.72 0.2 145 / 0.15)',
                          border: `1px solid ${bike.statusWarn ? 'oklch(0.76 0.18 60 / 0.35)' : 'oklch(0.72 0.2 145 / 0.35)'}`,
                          color: bike.statusWarn ? 'var(--mv-warm-400)' : 'var(--mv-success)',
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {t(bike.statusKey)}
                      </div>
                    </div>
                    {bike.hasMeta && (
                      <div
                        className="mv-grid-3"
                        style={{
                          marginTop: 16,
                          paddingTop: 14,
                          borderTop: '1px solid var(--mv-line)',
                          gap: 10,
                        }}
                      >
                        {[
                          { label: t('bikeMetaServicesLabel'), value: t('bikeMetaServicesValue') },
                          { label: t('bikeMetaThisYearLabel'), value: t('bikeMetaThisYearValue') },
                          { label: t('bikeMetaCostMiLabel'), value: t('bikeMetaCostMiValue') },
                        ].map((m) => (
                          <div
                            key={m.label}
                            className="mv-mono"
                            style={{
                              fontSize: 10,
                              color: 'var(--mv-ink-3)',
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {m.label}
                            <strong
                              style={{
                                display: 'block',
                                fontFamily: "var(--font-geist, 'Geist', sans-serif)",
                                fontSize: 13,
                                color: 'var(--mv-ink)',
                                fontWeight: 500,
                                textTransform: 'none',
                                letterSpacing: '-0.005em',
                                marginTop: 2,
                              }}
                            >
                              {m.value}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ════ PILLARS ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">{t('pillarsLabel')}</div>
          <h2 className="mv-section-title">
            {t('pillarsTitle')} <span className="mv-serif">{t('pillarsTitleSerif')}</span>
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
          {[
            {
              num: '01',
              title: t('pillar1Title'),
              body: t('pillar1Body'),
              kvLabel: t('pillar1KvLabel'),
              kvValue: t('pillar1KvValue'),
            },
            {
              num: '02',
              title: t('pillar2Title'),
              body: t('pillar2Body'),
              kvLabel: t('pillar2KvLabel'),
              kvValue: t('pillar2KvValue'),
            },
            {
              num: '03',
              title: t('pillar3Title'),
              body: t('pillar3Body'),
              kvLabel: t('pillar3KvLabel'),
              kvValue: t('pillar3KvValue'),
            },
            {
              num: '04',
              title: t('pillar4Title'),
              body: t('pillar4Body'),
              kvLabel: t('pillar4KvLabel'),
              kvValue: t('pillar4KvValue'),
            },
            {
              num: '05',
              title: t('pillar5Title'),
              body: t('pillar5Body'),
              kvLabel: t('pillar5KvLabel'),
              kvValue: t('pillar5KvValue'),
            },
            {
              num: '06',
              title: t('pillar6Title'),
              body: t('pillar6Body'),
              kvLabel: t('pillar6KvLabel'),
              kvValue: t('pillar6KvValue'),
            },
          ].map((p) => (
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

      {/* ════ MAINTENANCE TIMELINE ════ */}
      <section id="maint" className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">{t('maintLabel')}</div>
          <h2 className="mv-section-title">
            {t('maintTitle')} <span className="mv-serif">{t('maintTitleSerif')}</span>
          </h2>
          <p className="mv-section-sub">
            {t('maintSubtitle')}
          </p>
        </div>

        <div
          style={{
            marginTop: 60,
            border: '1px solid var(--mv-line)',
            borderRadius: 18,
            overflow: 'hidden',
          }}
        >
          {MAINT_ROW_VISUALS.map((row, i, arr) => (
            <div
              key={row.labelKey}
              className="mv-grid-table"
              style={{
                gap: 20,
                padding: '20px 24px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--mv-line)' : 'none',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'oklch(1 0 0 / 0.04)',
                  border: '1px solid var(--mv-line)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--mv-warm-400)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={row.icon} />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>
                  {t(row.labelKey)}
                </div>
                <div
                  className="mv-mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--mv-ink-3)',
                    marginTop: 3,
                    letterSpacing: '0.04em',
                  }}
                >
                  {t(row.subKey)}
                </div>
              </div>
              <div
                className="mv-mono"
                style={{ fontSize: 12, color: 'var(--mv-ink-2)', letterSpacing: '0.04em' }}
              >
                {t(row.dateKey)}
              </div>
              <div
                className="mv-mono"
                style={{ fontSize: 12, color: 'var(--mv-ink-3)', letterSpacing: '0.04em' }}
              >
                {t(row.milesKey)}
              </div>
              <div
                className="mv-mono"
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  background:
                    row.statusType === 'done'
                      ? 'oklch(0.72 0.2 145 / 0.15)'
                      : row.statusType === 'due'
                        ? 'oklch(0.76 0.18 60 / 0.15)'
                        : 'oklch(1 0 0 / 0.04)',
                  color:
                    row.statusType === 'done'
                      ? 'var(--mv-success)'
                      : row.statusType === 'due'
                        ? 'var(--mv-warm-400)'
                        : 'var(--mv-ink-3)',
                }}
              >
                {t(row.statusKey)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ EXPENSES -- donut chart ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">{t('expensesLabel')}</div>
          <h2 className="mv-section-title">
            {t('expensesTitle')} <span className="mv-serif">{t('expensesTitleSerif')}</span>
          </h2>
          <p className="mv-section-sub">
            {t('expensesSubtitle')}
          </p>
        </div>

        <div
          className="mv-grid-2"
          style={{
            marginTop: 80,
            gap: 48,
          }}
        >
          {/* Donut */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 340,
              aspectRatio: '1',
              margin: '0 auto',
            }}
          >
            <svg
              viewBox="0 0 100 100"
              style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="oklch(1 0 0 / 0.04)"
                strokeWidth="14"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="oklch(0.76 0.18 60)"
                strokeWidth="14"
                fill="none"
                strokeDasharray="88 251.33"
                strokeDashoffset="0"
                strokeLinecap="butt"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="oklch(0.84 0.15 68)"
                strokeWidth="14"
                fill="none"
                strokeDasharray="63 251.33"
                strokeDashoffset="-88"
                strokeLinecap="butt"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="oklch(0.6 0.13 60)"
                strokeWidth="14"
                fill="none"
                strokeDasharray="48 251.33"
                strokeDashoffset="-151"
                strokeLinecap="butt"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="oklch(0.45 0.1 60)"
                strokeWidth="14"
                fill="none"
                strokeDasharray="52 251.33"
                strokeDashoffset="-199"
                strokeLinecap="butt"
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 500,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {t('donutValue')}
                </div>
                <div
                  className="mv-mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    marginTop: 8,
                  }}
                >
                  {t('donutPeriod')}
                </div>
              </div>
            </div>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              {
                color: 'oklch(0.76 0.18 60)',
                label: t('expense1Label'),
                sub: t('expense1Sub'),
                value: t('expense1Value'),
              },
              {
                color: 'oklch(0.84 0.15 68)',
                label: t('expense2Label'),
                sub: t('expense2Sub'),
                value: t('expense2Value'),
              },
              {
                color: 'oklch(0.6 0.13 60)',
                label: t('expense3Label'),
                sub: t('expense3Sub'),
                value: t('expense3Value'),
              },
              {
                color: 'oklch(0.45 0.1 60)',
                label: t('expense4Label'),
                sub: t('expense4Sub'),
                value: t('expense4Value'),
              },
            ].map((item, i, arr) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  paddingBottom: i < arr.length - 1 ? 16 : 0,
                  borderBottom: i < arr.length - 1 ? '1px solid var(--mv-line)' : 'none',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 34,
                    borderRadius: 3,
                    flexShrink: 0,
                    background: item.color,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, letterSpacing: '-0.005em' }}>{item.label}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--mv-ink-3)',
                      marginTop: 2,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {item.sub}
                  </div>
                </div>
                <div
                  className="mv-mono"
                  style={{
                    fontSize: 14,
                    color: 'var(--mv-ink)',
                    letterSpacing: '0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ STATS ROW ════ */}
      <section className="mv-section-stats mv-grid-stats">
        {[
          { value: t('stat1Value'), unit: '', label: t('stat1Label') },
          { value: t('stat2Value'), unit: t('stat2Unit'), label: t('stat2Label') },
          { value: t('stat3Value'), unit: t('stat3Unit'), label: t('stat3Label') },
          { value: t('stat4Value'), unit: t('stat4Unit'), label: t('stat4Label') },
        ].map((s) => (
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
              {s.unit && (
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {s.unit}
                </span>
              )}
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
      <section
        className="mv-section-cta"
        style={{
          position: 'relative',
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
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
            {t('ctaTitle')}{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              {t('ctaTitleSerif')}
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
            <Link href="/features/ai-diagnostics" className="mv-btn mv-btn-ghost">
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
            href="/features/learning-paths"
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
            href="/features/trip-planning"
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
            <GarageManagementFaq items={faqItems} />
          </div>
        </div>
      </section>

      {/* ════ BOTTOM CTA ════ */}
      <FeatureCta />
    </>
  );
}
