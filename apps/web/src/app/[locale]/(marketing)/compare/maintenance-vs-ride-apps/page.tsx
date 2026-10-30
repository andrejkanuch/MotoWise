import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
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

  return (
    <div className="mv-cmp-page">
      <CompareStyles />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      {/* Hero */}
      <header className="mv-cmp-wrap pt-28 md:pt-32">
        <CompareBreadcrumb current={t('breadcrumbLabel')} />
        <h1 className="mv-cmp-h1 mt-8">{t('heroTitle')}</h1>
        <p className="mv-cmp-lede mt-6">{t('heroSubtitle')}</p>
        <p className="mv-cmp-meta mt-4">{t('updatedAt')}</p>
      </header>

      {/* The two categories side by side, hairline between.
          The reveal is this page's one authored entrance. */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <div className="mv-reveal grid gap-12 lg:grid-cols-[1fr_1px_1fr]">
          {CATEGORIES.map(({ titleKey, subtitleKey, featurePrefix, appsKey }, col) => (
            <div key={titleKey} className={col === 1 ? 'lg:col-start-3' : undefined}>
              <h2 className="mv-cmp-h2">{t(titleKey)}</h2>
              <p className="mv-cmp-note mt-3">{t(subtitleKey)}</p>
              <ul className="mv-cmp-list mt-6">
                {FEATURE_INDICES.map((i) => (
                  <li key={i} className="py-4">
                    <h3 className="mv-cmp-sub" style={{ fontSize: 15 }}>
                      {t(`${featurePrefix}.${i}.title`)}
                    </h3>
                    <p className="mv-cmp-body is-full mt-1.5" style={{ fontSize: 14 }}>
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
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">{t('gapTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('gapSubtitle')}</p>
        <p className="mv-cmp-body mt-6">{t('gapContent')}</p>

        <h3 className="mv-cmp-h3 mt-12">{t('bridgeTitle')}</h3>
        <p className="mv-cmp-body mt-4">{t('bridgeContent')}</p>
      </section>

      {/* Why both: three reasons across */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <h2 className="mv-cmp-h2">{t('whyBothTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('whyBothSubtitle')}</p>
        <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-3">
          {WHY_BOTH_INDICES.map((i) => (
            <div key={i} className="pt-4" style={{ borderTop: '1px solid var(--mv-line)' }}>
              <h3 className="mv-cmp-sub" style={{ fontSize: 15 }}>
                {t(`whyBoth.${i}.title`)}
              </h3>
              <p className="mv-cmp-body is-full mt-2" style={{ fontSize: 14 }}>
                {t(`whyBoth.${i}.description`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendation: the one card on the page */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <div className="mv-cmp-card">
          <h2 className="mv-cmp-h2">{t('verdictTitle')}</h2>
          <p className="mv-cmp-body is-strong mt-5">{t('verdict')}</p>
        </div>
      </section>

      {/* Related comparisons */}
      <section className="mv-cmp-wrap pt-20 md:pt-28">
        <CompareLinkList ids={['alternatives', 'ridelog', 'rever']} />
      </section>

      {/* FAQ */}
      <section className="mv-cmp-wrap py-20 md:py-28">
        <CompareFaq items={faqItems} />
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </div>
  );
}
