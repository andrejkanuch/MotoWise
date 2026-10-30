import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  COMPARE_CHECKED_DATE,
  COMPARE_SECTION,
  CompareBreadcrumb,
  CompareFaq,
  CompareLinkList,
  CompareStyles,
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

const CATEGORIES = [
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

const FEATURE_INDICES = [0, 1, 2, 3] as const;
const WHY_BOTH_INDICES = [0, 1, 2] as const;
const FAQ_INDICES = [0, 1, 2, 3] as const;

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

  const faqItems = FAQ_INDICES.map((i) => ({
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

  const dated = { date: COMPARE_CHECKED_DATE };

  return (
    <div className="mv-cmp-page">
      <CompareStyles />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      {/* Hero */}
      <header className={`mv-cmp-wrap ${COMPARE_SECTION.header}`}>
        <CompareBreadcrumb current={t('breadcrumbLabel')} />
        <h1 className="mv-section-title">{t('heroTitle')}</h1>
        <p className="mv-section-sub">{t('heroSubtitle')}</p>
        <p className="mv-cmp-meta mt-5">{t('updatedAt', dated)}</p>
      </header>

      {/* The two categories side by side, hairline between.
          The reveal is this page's one authored entrance. */}
      <section className={`mv-cmp-wrap mv-reveal ${COMPARE_SECTION.weight}`}>
        <div className="grid gap-12 lg:grid-cols-[1fr_1px_1fr]">
          {CATEGORIES.map(({ titleKey, subtitleKey, featurePrefix, appsKey }, col) => (
            <div key={titleKey} className={col === 1 ? 'lg:col-start-3' : undefined}>
              <h2 className="mv-h2">{t(titleKey)}</h2>
              <p className="mv-cmp-note mt-4">{t(subtitleKey)}</p>
              <ul className="mv-rows mt-6">
                {FEATURE_INDICES.map((i) => (
                  <li key={i} className="mv-row mv-cmp-grid-row">
                    <h3 className="mv-cmp-sub">{t(`${featurePrefix}.${i}.title`)}</h3>
                    <p className="mv-cmp-body is-compact is-full">
                      {t(`${featurePrefix}.${i}.description`)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mv-cmp-meta mt-4">{t(appsKey)}</p>
            </div>
          ))}
          <div
            aria-hidden="true"
            className="mv-cmp-rule hidden lg:col-start-2 lg:row-start-1 lg:block"
          />
        </div>
      </section>

      {/* The gap, and the apps that bridge it */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <h2 className="mv-h2">{t('gapTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('gapSubtitle')}</p>
        <p className="mv-cmp-body mt-6">{t('gapContent')}</p>

        <h3 className="mv-h3 mt-12">{t('bridgeTitle')}</h3>
        <p className="mv-cmp-body mt-4">{t('bridgeContent')}</p>
      </section>

      {/* Why both: three reasons as hairline rows */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <h2 className="mv-h2">{t('whyBothTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('whyBothSubtitle')}</p>
        <ul className="mv-rows mt-10">
          {WHY_BOTH_INDICES.map((i) => (
            <li key={i} className="mv-row mv-cmp-grid-row md:grid-cols-[240px_1fr]">
              <h3 className="mv-cmp-sub">{t(`whyBoth.${i}.title`)}</h3>
              <p className="mv-cmp-body is-compact is-full">{t(`whyBoth.${i}.description`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Recommendation: the one card on the page */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.weight}`}>
        <div className="mv-cmp-card">
          <h2 className="mv-h2">{t('verdictTitle')}</h2>
          <p className="mv-cmp-body is-strong mt-5">{t('verdict')}</p>
        </div>
      </section>

      {/* Related comparisons */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <CompareLinkList ids={['alternatives', 'ridelog', 'rever']} />
      </section>

      {/* FAQ */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.faq}`}>
        <CompareFaq items={faqItems} />
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </div>
  );
}
