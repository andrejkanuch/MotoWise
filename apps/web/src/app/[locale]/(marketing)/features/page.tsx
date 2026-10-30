import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface FeatureEntry {
  titleKey: string;
  descKey: string;
  href:
    | '/features/garage-management'
    | '/features/maintenance'
    | '/features/expense-tracking'
    | '/features/ride-tracking'
    | '/features/trip-planning'
    | '/features/ai-diagnostics'
    | '/features/learning-paths';
}

/** The records of each bike: the logbook the app is built around. */
const LOGBOOK_FEATURES: readonly FeatureEntry[] = [
  { titleKey: 'garageTitle', descKey: 'garageDesc', href: '/features/garage-management' },
  { titleKey: 'maintenanceTitle', descKey: 'maintenanceDesc', href: '/features/maintenance' },
  { titleKey: 'expensesTitle', descKey: 'expensesDesc', href: '/features/expense-tracking' },
  { titleKey: 'ridesTitle', descKey: 'ridesDesc', href: '/features/ride-tracking' },
];

/** Everything built on top of the logbook. */
const RIDE_FEATURES: readonly FeatureEntry[] = [
  { titleKey: 'tripPlanningTitle', descKey: 'tripPlanningDesc', href: '/features/trip-planning' },
  { titleKey: 'diagnosticsTitle', descKey: 'diagnosticsDesc', href: '/features/ai-diagnostics' },
  { titleKey: 'learningTitle', descKey: 'learningDesc', href: '/features/learning-paths' },
];

const ROW_TITLE_STYLE = {
  margin: 0,
  fontWeight: 600,
  lineHeight: 1.05,
  color: 'var(--mv-ink)',
} as const;

const ROW_DESC_STYLE = {
  margin: '10px 0 0',
  fontSize: '15px',
  lineHeight: 1.6,
  color: 'var(--mv-ink-2)',
  maxWidth: '52ch',
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesIndex');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features'),
      languages: getHreflangMap('/features'),
    },
  };
}

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export default async function FeaturesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesIndex');

  const canonical = getCanonicalUrl(locale, '/features');

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/features',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features',
    ),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* Hero: breadcrumb + condensed headline, left-aligned on the ground */}
      <header className="mv-section-hero" style={{ paddingTop: '128px', paddingBottom: '48px' }}>
        <div style={{ maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ marginBottom: '40px' }}>
            <ol
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '10px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--mv-ink-3)',
              }}
            >
              <li>
                <Link href="/" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
                  {t('breadcrumbHome')}
                </Link>
              </li>
              <li aria-hidden="true" style={{ color: 'var(--mv-ink-4)' }}>
                /
              </li>
              <li>
                <span aria-current="page" style={{ color: 'var(--mv-ink)' }}>
                  {t('title')}
                </span>
              </li>
            </ol>
          </nav>

          <h1 className="mv-section-title" style={{ maxWidth: '14ch', textWrap: 'balance' }}>
            {t('heroTitle')}
          </h1>
          <p className="mv-section-sub">{t('heroSubtitle')}</p>
        </div>
      </header>

      {/* The logbook: the four record features, large, beside the group's
          one sentence. Hairline rows on the ground; copper on the arrow only. */}
      <section className="mv-section" style={{ paddingTop: '64px', paddingBottom: '120px' }}>
        <div
          className="grid gap-12 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
          style={{ alignItems: 'start' }}
        >
          <div>
            <h2
              className="mv-display"
              style={{
                margin: 0,
                fontSize: 'clamp(34px, 4.2vw, 56px)',
                fontWeight: 700,
                lineHeight: 1.02,
                color: 'var(--mv-ink)',
              }}
            >
              {t('groupLogbookTitle')}
            </h2>
            <p
              style={{
                margin: '20px 0 0',
                fontSize: '17px',
                lineHeight: 1.6,
                color: 'var(--mv-ink-2)',
                maxWidth: '32ch',
              }}
            >
              {t('groupLogbookBody')}
            </p>
          </div>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              borderBottom: '1px solid var(--mv-line)',
            }}
          >
            {LOGBOOK_FEATURES.map((feature) => (
              <li key={feature.href} style={{ borderTop: '1px solid var(--mv-line)' }}>
                <Link
                  href={feature.href}
                  className="group"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    alignItems: 'start',
                    gap: '24px',
                    padding: '32px 0',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <span>
                    <h3
                      className="mv-display"
                      style={{ ...ROW_TITLE_STYLE, fontSize: 'clamp(30px, 3.4vw, 44px)' }}
                    >
                      {t(feature.titleKey)}
                    </h3>
                    <p style={ROW_DESC_STYLE}>{t(feature.descKey)}</p>
                  </span>
                  <span
                    className="transition-transform duration-300 group-hover:translate-x-1"
                    style={{ color: 'var(--mv-copper-text)', marginTop: '10px' }}
                  >
                    <ArrowIcon />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Around the ride: the three features built on the logbook, in a
          tighter two-column list on the deeper ramp step. */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div className="mv-section-inner">
          <h2
            className="mv-display"
            style={{
              margin: 0,
              fontSize: 'clamp(30px, 3.6vw, 48px)',
              fontWeight: 700,
              lineHeight: 1.02,
              color: 'var(--mv-ink)',
            }}
          >
            {t('groupMoreTitle')}
          </h2>
          <p
            style={{
              margin: '16px 0 0',
              fontSize: '17px',
              lineHeight: 1.6,
              color: 'var(--mv-ink-2)',
              maxWidth: '44ch',
            }}
          >
            {t('groupMoreBody')}
          </p>
          <ul
            className="grid md:grid-cols-3 md:gap-x-12"
            style={{ listStyle: 'none', margin: '48px 0 0', padding: 0 }}
          >
            {RIDE_FEATURES.map((feature) => (
              <li key={feature.href} style={{ borderTop: '1px solid var(--mv-line)' }}>
                <Link
                  href={feature.href}
                  className="group"
                  style={{
                    display: 'block',
                    padding: '24px 0 32px',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <h3
                    className="mv-display"
                    style={{ ...ROW_TITLE_STYLE, fontSize: 'clamp(26px, 2.6vw, 34px)' }}
                  >
                    {t(feature.titleKey)}
                  </h3>
                  <p style={{ ...ROW_DESC_STYLE, maxWidth: '36ch' }}>{t(feature.descKey)}</p>
                  <span
                    style={{
                      marginTop: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: 'var(--mv-copper-text)',
                    }}
                  >
                    {t('learnMore')}
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      <ArrowIcon />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <FeatureCta />
    </>
  );
}
