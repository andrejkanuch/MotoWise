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

const FEATURES = [
  { titleKey: 'tripPlanningTitle', descKey: 'tripPlanningDesc', href: '/features/trip-planning' },
  { titleKey: 'diagnosticsTitle', descKey: 'diagnosticsDesc', href: '/features/ai-diagnostics' },
  { titleKey: 'garageTitle', descKey: 'garageDesc', href: '/features/garage-management' },
  { titleKey: 'learningTitle', descKey: 'learningDesc', href: '/features/learning-paths' },
  { titleKey: 'maintenanceTitle', descKey: 'maintenanceDesc', href: '/features/maintenance' },
  { titleKey: 'expensesTitle', descKey: 'expensesDesc', href: '/features/expense-tracking' },
  { titleKey: 'ridesTitle', descKey: 'ridesDesc', href: '/features/ride-tracking' },
] as const;

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

      {/* Hero: breadcrumb + condensed display headline, left-aligned on the ground */}
      <header className="mv-section-hero" style={{ paddingTop: '128px', paddingBottom: '72px' }}>
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
                  Home
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

          <h1 className="mv-section-title" style={{ maxWidth: '16ch' }}>
            {t('heroTitle')}
          </h1>
          <p className="mv-section-sub">{t('heroSubtitle')}</p>
        </div>
      </header>

      {/* Feature index: hairline rows directly on the page — no cards, no icon
          tiles. The copper lives on the action link only. */}
      <section className="mv-section" style={{ paddingTop: '48px' }}>
        <div className="mv-grid-cards" style={{ columnGap: '80px', rowGap: 0 }}>
          {FEATURES.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              style={{
                display: 'block',
                padding: '32px 0',
                borderTop: '1px solid var(--mv-line)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <h2
                className="mv-display"
                style={{
                  margin: 0,
                  fontSize: 'clamp(24px, 2.6vw, 34px)',
                  fontWeight: 600,
                  lineHeight: 1.05,
                  color: 'var(--mv-ink)',
                }}
              >
                {t(feature.titleKey)}
              </h2>
              <p
                style={{
                  margin: '12px 0 0',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: 'var(--mv-ink-2)',
                  maxWidth: '52ch',
                }}
              >
                {t(feature.descKey)}
              </p>
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
                <svg
                  width="15"
                  height="15"
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
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
