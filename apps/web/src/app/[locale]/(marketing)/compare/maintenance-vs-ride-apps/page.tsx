import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  CompareBreadcrumb,
  CompareFaq,
  CompareRelatedLinks,
  compareBodyStyle,
  compareH1Style,
  compareH2Style,
  compareH3Style,
} from '@/components/marketing/compare-page';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { getCanonicalUrl } from '@/lib/constants';
import { CtaPageType } from '@/lib/cta-taxonomy';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareMaintVsRide');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/maintenance-vs-ride-apps'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/compare/maintenance-vs-ride-apps')]),
        ['x-default', getCanonicalUrl('en', '/compare/maintenance-vs-ride-apps')],
      ]),
    },
  };
}

const RELATED_LINKS = [
  {
    href: '/compare',
    title: 'Best Motorcycle Apps 2026',
    description: 'Full feature matrix and ranking of 10 motorcycle apps.',
  },
  {
    href: '/compare/alternatives',
    title: 'Motorcycle App Alternatives',
    description: 'Switching from REVER, RideLog, or Calimoto? See how alternatives compare.',
  },
] as const;

export default async function MaintVsRidePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareMaintVsRide');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: getCanonicalUrl(locale) },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Compare',
        item: getCanonicalUrl(locale, '/compare'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Maintenance vs Ride Apps',
        item: getCanonicalUrl(locale, '/compare/maintenance-vs-ride-apps'),
      },
    ],
  };

  const faqItems = [0, 1, 2, 3].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  const categories = [
    {
      titleKey: 'maintTitle',
      subtitleKey: 'maintSubtitle',
      featurePrefix: 'maintFeatures',
      appsKey: 'maintApps',
    },
    {
      titleKey: 'rideTitle',
      subtitleKey: 'rideSubtitle',
      featurePrefix: 'rideFeatures',
      appsKey: 'rideApps',
    },
  ] as const;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      {/* Hero — one condensed H1, left-aligned */}
      <header className="mx-auto max-w-5xl px-6 pt-28 md:pt-32">
        <CompareBreadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Compare', href: '/compare' },
            { label: 'Maintenance vs. Ride Apps' },
          ]}
        />
        <h1 className="mt-8" style={compareH1Style}>
          {t('heroTitle')}
        </h1>
        <p className="mt-6" style={{ ...compareBodyStyle, fontSize: 17, maxWidth: '58ch' }}>
          {t('heroSubtitle')}
        </p>
        <p className="mt-3" style={{ fontSize: 13, color: 'var(--mv-ink-4)' }}>
          {t('updatedAt')}
        </p>
      </header>

      {/* Two categories — plain typographic columns, hairline between */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1px_1fr]">
          {categories.map(({ titleKey, subtitleKey, featurePrefix, appsKey }, col) => (
            <div key={titleKey} className={col === 1 ? 'lg:col-start-3' : undefined}>
              <h2 style={compareH2Style}>{t(titleKey)}</h2>
              <p
                className="mt-3"
                style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}
              >
                {t(subtitleKey)}
              </p>
              <div className="mt-6" style={{ borderBottom: '1px solid var(--mv-line)' }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="py-4" style={{ borderTop: '1px solid var(--mv-line)' }}>
                    <h3
                      style={{ fontSize: 15, fontWeight: 600, color: 'var(--mv-ink)', margin: 0 }}
                    >
                      {t(`${featurePrefix}.${i}.title`)}
                    </h3>
                    <p
                      className="mt-1.5"
                      style={{ ...compareBodyStyle, fontSize: 14, maxWidth: 'none' }}
                    >
                      {t(`${featurePrefix}.${i}.description`)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4" style={{ fontSize: 13, color: 'var(--mv-ink-4)' }}>
                {t(appsKey)}
              </p>
            </div>
          ))}
          <div
            aria-hidden="true"
            className="hidden lg:col-start-2 lg:row-start-1 lg:block"
            style={{ background: 'var(--mv-line)' }}
          />
        </div>
      </section>

      {/* The gap */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('gapTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}>
          {t('gapSubtitle')}
        </p>
        <p className="mt-6" style={compareBodyStyle}>
          {t('gapContent')}
        </p>

        <h3 className="mt-12" style={compareH3Style}>
          {t('bridgeTitle')}
        </h3>
        <p className="mt-4" style={compareBodyStyle}>
          {t('bridgeContent')}
        </p>
      </section>

      {/* Why you need both — plain three-column grid */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('whyBothTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}>
          {t('whyBothSubtitle')}
        </p>
        <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pt-4" style={{ borderTop: '1px solid var(--mv-line)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--mv-ink)', margin: 0 }}>
                {t(`whyBoth.${i}.title`)}
              </h3>
              <p className="mt-2" style={{ ...compareBodyStyle, fontSize: 14, maxWidth: 'none' }}>
                {t(`whyBoth.${i}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendation — the one allowed card on the page */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <div
          style={{
            background: 'var(--mv-surface)',
            border: '1px solid var(--mv-line)',
            borderRadius: 'var(--mv-radius-card)',
            padding: 'clamp(24px, 4vw, 40px)',
          }}
        >
          <h2 style={compareH2Style}>{t('verdictTitle')}</h2>
          <p className="mt-5" style={{ ...compareBodyStyle, fontSize: 17, color: 'var(--mv-ink)' }}>
            {t('verdict')}
          </p>
        </div>
      </section>

      {/* Related comparisons — plain links */}
      <section className="mx-auto max-w-5xl px-6 pt-20 md:pt-28">
        <CompareRelatedLinks links={RELATED_LINKS} />
      </section>

      {/* FAQ — hairline details */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <h2 style={compareH2Style}>Frequently asked questions</h2>
        <div className="mt-8" style={{ maxWidth: 760 }}>
          <CompareFaq items={faqItems} />
        </div>
      </section>

      {/* CTA */}
      <FeatureCta pageType={CtaPageType.Compare} />
    </>
  );
}
