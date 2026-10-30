import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { GarageManagementFaq } from './faq';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

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
    hasMeta: false,
  },
  {
    abbr: 'GS',
    nameKey: 'bike2Name',
    subKey: 'bike2Sub',
    statusKey: 'bike2Status',
    statusWarn: true,
    hasMeta: true,
  },
  {
    abbr: 'SV',
    nameKey: 'bike3Name',
    subKey: 'bike3Sub',
    statusKey: 'bike3Status',
    statusWarn: false,
    hasMeta: false,
  },
  {
    abbr: 'GR',
    nameKey: 'bike4Name',
    subKey: 'bike4Sub',
    statusKey: 'bike4Status',
    statusWarn: false,
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

/** Depicted app status → ink token (status colour only inside app depictions) */
const MAINT_STATUS_COLOR: Record<string, string> = {
  done: 'var(--mv-go)',
  due: 'var(--mv-due-ink)',
  wait: 'var(--mv-ink-3)',
};

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
      <section className="mv-section-hero" style={{ position: 'relative' }}>
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
            {t('breadcrumbFeatures')}
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
              <a href="#maint" className="mv-btn mv-btn-ghost">
                {t('heroCtaSecondary')}
              </a>
            </div>
          </div>

          {/* Garage stack visual — depicted app rows as solid surface steps */}
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
                      background: 'var(--mv-surface-2)',
                      border: '1px solid var(--mv-line)',
                      borderRadius: 'var(--mv-radius-card)',
                      padding: '22px 24px',
                      top: pos.top,
                      transform: pos.transform,
                      zIndex: pos.zIndex,
                      opacity: pos.opacity,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div
                        className="mv-display"
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 'var(--mv-radius-control)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          background: 'var(--mv-surface-3)',
                          color: 'var(--mv-ink)',
                          fontWeight: 600,
                          fontSize: 16,
                        }}
                      >
                        {bike.abbr}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            color: 'var(--mv-ink)',
                          }}
                        >
                          {t(bike.nameKey)}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--mv-ink-3)',
                            marginTop: 4,
                          }}
                        >
                          {t(bike.subKey)}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          color: bike.statusWarn ? 'var(--mv-due-ink)' : 'var(--mv-go)',
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
                            style={{
                              fontSize: 11,
                              color: 'var(--mv-ink-3)',
                            }}
                          >
                            {m.label}
                            <strong
                              className="mv-figure"
                              style={{
                                display: 'block',
                                fontSize: 15,
                                color: 'var(--mv-ink)',
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
          <h2 className="mv-section-title">
            {t('pillarsTitle')} <span className="mv-muted">{t('pillarsTitleSerif')}</span>
          </h2>
        </div>

        <div className="mv-grid-3" style={{ marginTop: 72, columnGap: 48, rowGap: 56 }}>
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

      {/* ════ MAINTENANCE TIMELINE ════ */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div id="maint" className="mv-section-inner">
          <div style={{ maxWidth: 860 }}>
            <h2 className="mv-section-title">
              {t('maintTitle')} <span className="mv-muted">{t('maintTitleSerif')}</span>
            </h2>
            <p className="mv-section-sub">{t('maintSubtitle')}</p>
          </div>

          <div style={{ marginTop: 56, borderBottom: '1px solid var(--mv-line)' }}>
            {MAINT_ROW_VISUALS.map((row) => (
              <div
                key={row.labelKey}
                className="mv-grid-table"
                style={{
                  gap: 20,
                  padding: '20px 0',
                  borderTop: '1px solid var(--mv-line)',
                  alignItems: 'center',
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--mv-ink-3)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={row.icon} />
                </svg>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: '-0.005em',
                      color: 'var(--mv-ink)',
                    }}
                  >
                    {t(row.labelKey)}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--mv-ink-3)',
                      marginTop: 3,
                    }}
                  >
                    {t(row.subKey)}
                  </div>
                </div>
                <div className="mv-figure" style={{ fontSize: 14, color: 'var(--mv-ink-2)' }}>
                  {t(row.dateKey)}
                </div>
                <div className="mv-figure" style={{ fontSize: 14, color: 'var(--mv-ink-3)' }}>
                  {t(row.milesKey)}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    color: MAINT_STATUS_COLOR[row.statusType],
                  }}
                >
                  {t(row.statusKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ EXPENSES — donut chart ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <h2 className="mv-section-title">
            {t('expensesTitle')} <span className="mv-muted">{t('expensesTitleSerif')}</span>
          </h2>
          <p className="mv-section-sub">{t('expensesSubtitle')}</p>
        </div>

        <div className="mv-grid-2" style={{ marginTop: 72, gap: 48 }}>
          {/* Donut — tonal graphite ramp, no decorative hues */}
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
                stroke="var(--mv-surface-2)"
                strokeWidth="14"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="var(--mv-ink)"
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
                stroke="var(--mv-ink-2)"
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
                stroke="var(--mv-ink-3)"
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
                stroke="var(--mv-ink-4)"
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
                  className="mv-figure"
                  style={{
                    fontSize: 42,
                    lineHeight: 1,
                    color: 'var(--mv-ink)',
                  }}
                >
                  {t('donutValue')}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--mv-ink-3)',
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
                color: 'var(--mv-ink)',
                label: t('expense1Label'),
                sub: t('expense1Sub'),
                value: t('expense1Value'),
              },
              {
                color: 'var(--mv-ink-2)',
                label: t('expense2Label'),
                sub: t('expense2Sub'),
                value: t('expense2Value'),
              },
              {
                color: 'var(--mv-ink-3)',
                label: t('expense3Label'),
                sub: t('expense3Sub'),
                value: t('expense3Value'),
              },
              {
                color: 'var(--mv-ink-4)',
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
                  <div style={{ fontSize: 14, letterSpacing: '-0.005em', color: 'var(--mv-ink)' }}>
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--mv-ink-3)',
                      marginTop: 2,
                    }}
                  >
                    {item.sub}
                  </div>
                </div>
                <div className="mv-figure" style={{ fontSize: 16, color: 'var(--mv-ink)' }}>
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
              className="mv-figure"
              style={{
                fontSize: 'clamp(32px, 3.6vw, 52px)',
                lineHeight: 1,
                color: 'var(--mv-ink)',
              }}
            >
              {s.value}
              {s.unit && <span style={{ color: 'var(--mv-ink-3)' }}>{s.unit}</span>}
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
            {t('ctaTitle')} {t('ctaTitleSerif')}
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

      {/* ════ NEXT FEATURES ════ */}
      <section className="mv-section-nav">
        <div className="mv-grid-cards" style={{ columnGap: 80, rowGap: 0 }}>
          {[
            {
              href: '/features/learning-paths' as const,
              title: `${t('nextFeature1Title')} ${t('nextFeature1Serif')}`,
              sub: t('nextFeature1Sub'),
            },
            {
              href: '/features/trip-planning' as const,
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
            <GarageManagementFaq items={faqItems} />
          </div>
        </div>
      </section>

      {/* ════ BOTTOM CTA ════ */}
      <FeatureCta />
    </>
  );
}
