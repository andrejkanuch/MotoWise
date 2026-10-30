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

/** Compact body for list rows: 16/1.55. */
const ROW_DESC_STYLE = {
  margin: '8px 0 0',
  fontSize: '16px',
  lineHeight: 1.55,
  color: 'var(--mv-ink-2)',
  maxWidth: '52ch',
  textWrap: 'pretty',
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

function CrumbSeparator() {
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
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/** One feature as a hairline row: the title is the link, the arrow its verb. */
function FeatureRow({
  feature,
  title,
  desc,
}: {
  feature: FeatureEntry;
  title: string;
  desc: string;
}) {
  return (
    <li>
      <Link href={feature.href} className="mv-row" style={{ alignItems: 'start' }}>
        <span>
          <h3 className="mv-h3">{title}</h3>
          <p style={ROW_DESC_STYLE}>{desc}</p>
        </span>
        <span style={{ marginTop: '8px', display: 'inline-flex' }}>
          <ArrowIcon />
        </span>
      </Link>
    </li>
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
      <header className="mv-section-hero" style={{ paddingTop: '120px', paddingBottom: '48px' }}>
        <div style={{ maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ marginBottom: '40px' }}>
            <ol className="mv-crumbs" style={{ margin: 0 }}>
              <li>
                <Link href="/">{t('breadcrumbHome')}</Link>
              </li>
              <li>
                <CrumbSeparator />
                <span aria-current="page">{t('title')}</span>
              </li>
            </ol>
          </nav>

          <h1 className="mv-section-title" style={{ maxWidth: '14ch' }}>
            {t('heroTitle')}
          </h1>
          <p className="mv-section-sub">{t('heroSubtitle')}</p>
        </div>
      </header>

      {/* The logbook: the four record features beside the group's one
          sentence. Hairline rows on the ground; the arrow is the verb. */}
      <section className="mv-section" style={{ paddingTop: '64px', paddingBottom: '120px' }}>
        <div
          className="grid gap-12 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
          style={{ alignItems: 'start' }}
        >
          <div>
            <h2 className="mv-h2">{t('groupLogbookTitle')}</h2>
            <p className="mv-section-sub" style={{ maxWidth: '48ch' }}>
              {t('groupLogbookBody')}
            </p>
          </div>
          <ul className="mv-rows">
            {LOGBOOK_FEATURES.map((feature) => (
              <FeatureRow
                key={feature.href}
                feature={feature}
                title={t(feature.titleKey)}
                desc={t(feature.descKey)}
              />
            ))}
          </ul>
        </div>
      </section>

      {/* Around the ride: the three features built on the logbook, in the
          same row grammar on the deeper ramp step. */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div className="mv-section-inner" style={{ paddingTop: '96px', paddingBottom: '120px' }}>
          <div
            className="grid gap-12 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
            style={{ alignItems: 'start' }}
          >
            <div>
              <h2 className="mv-h2">{t('groupMoreTitle')}</h2>
              <p className="mv-section-sub" style={{ maxWidth: '48ch' }}>
                {t('groupMoreBody')}
              </p>
            </div>
            <ul className="mv-rows">
              {RIDE_FEATURES.map((feature) => (
                <FeatureRow
                  key={feature.href}
                  feature={feature}
                  title={t(feature.titleKey)}
                  desc={t(feature.descKey)}
                />
              ))}
            </ul>
          </div>
        </div>
      </section>

      <FeatureCta />
    </>
  );
}
