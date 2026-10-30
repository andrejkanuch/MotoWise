import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  COMPARE_CHECKED_DATE,
  COMPARE_SECTION,
  CompareBreadcrumb,
  CompareFaq,
  CompareLinkList,
  CompareMarkCell,
  type ComparePageId,
  CompareStyles,
  GUIDE_IDS,
  getCompareMarkLabels,
  HEAD_TO_HEAD_IDS,
} from '@/components/marketing/compare-page';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { StoreButtons } from '@/components/marketing/store-buttons';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { CtaPageType, CtaPlacement } from '@/lib/cta-taxonomy';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Compare');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      // Compare index has untranslated content — always canonical to unprefixed URL.
      canonical: `${BASE_URL}/compare`,
      languages: { 'x-default': `${BASE_URL}/compare` },
    },
  };
}

// Row order = differentiation priority. Lead with the jobs riders pay for
// (expense tracking first; maintenance and reminders next), then the ride,
// route and garage basics. AI diagnostics and learning sit near the bottom:
// supporting features, not the headline. The i18n key and the APPS boolean
// for each row sit side by side so they cannot drift apart.
const FEATURES = [
  { labelKey: 'featureExpenses', field: 'expenses' },
  { labelKey: 'featureMaintenance', field: 'maintenance' },
  { labelKey: 'featureReminders', field: 'reminders' },
  { labelKey: 'featureRides', field: 'rides' },
  { labelKey: 'featureRoutes', field: 'routes' },
  { labelKey: 'featureMultiBike', field: 'multiBike' },
  { labelKey: 'featureLearning', field: 'learning' },
  { labelKey: 'featureDiagnostics', field: 'diagnostics' },
  { labelKey: 'featureFree', field: 'free' },
] as const;

type FeatureField = (typeof FEATURES)[number]['field'];

interface AppRow extends Record<FeatureField, boolean> {
  key: string;
  /** The head-to-head page for this app, when one exists (the matrix column
   *  and the comparisons list below share this id). */
  page?: ComparePageId;
}

const APPS: ReadonlyArray<AppRow> = [
  {
    key: 'app0',
    maintenance: true,
    expenses: true,
    rides: true,
    diagnostics: true,
    learning: true,
    multiBike: true,
    reminders: true,
    // Trip planning (multi-day routes, typed waypoints, rider RSVPs, real road
    // routing) is a shipped feature — see /features/trip-planning. It counts as
    // route planning here; the head-to-head pages carry the nuance that we do
    // not do bend-weighted curvy-road turn-by-turn.
    routes: true,
    free: true,
  },
  {
    key: 'app1',
    page: 'ridelog',
    maintenance: true,
    expenses: true,
    rides: true,
    diagnostics: false,
    learning: false,
    multiBike: true,
    reminders: true,
    routes: false,
    free: true,
  },
  {
    key: 'app2',
    page: 'rever',
    maintenance: false,
    expenses: false,
    rides: true,
    diagnostics: false,
    learning: false,
    multiBike: false,
    reminders: false,
    routes: true,
    free: true,
  },
  {
    key: 'app3',
    page: 'calimoto',
    maintenance: false,
    expenses: false,
    rides: true,
    diagnostics: false,
    learning: false,
    multiBike: false,
    reminders: false,
    routes: true,
    free: false,
  },
  {
    key: 'app4',
    page: 'motormanage',
    maintenance: true,
    expenses: true,
    rides: false,
    diagnostics: false,
    learning: false,
    multiBike: true,
    reminders: true,
    routes: false,
    free: true,
  },
  {
    key: 'app5',
    page: 'motoShed',
    maintenance: true,
    expenses: true,
    rides: false,
    diagnostics: false,
    learning: false,
    multiBike: true,
    reminders: true,
    routes: false,
    free: false,
  },
  {
    key: 'app6',
    maintenance: true,
    expenses: true,
    rides: false,
    diagnostics: false,
    learning: false,
    multiBike: true,
    reminders: true,
    routes: false,
    free: true,
  },
  {
    key: 'app7',
    page: 'eatsleepride',
    maintenance: false,
    expenses: false,
    rides: true,
    diagnostics: false,
    learning: false,
    multiBike: false,
    reminders: false,
    routes: false,
    free: true,
  },
  {
    key: 'app8',
    page: 'scenic',
    maintenance: false,
    expenses: false,
    rides: true,
    diagnostics: false,
    learning: false,
    multiBike: false,
    reminders: false,
    routes: true,
    free: false,
  },
  {
    key: 'app9',
    page: 'motoscan',
    maintenance: false,
    expenses: false,
    rides: false,
    diagnostics: true,
    learning: false,
    multiBike: false,
    reminders: false,
    routes: false,
    free: false,
  },
];

const VERDICT_INDICES = [1, 2, 3, 4] as const;
const FAQ_INDICES = [0, 1, 2, 3, 4] as const;

export default async function ComparePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, markLabels] = await Promise.all([getTranslations('Compare'), getCompareMarkLabels()]);

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: getCanonicalUrl(locale) },
      {
        '@type': 'ListItem',
        position: 2,
        name: t('title'),
        item: getCanonicalUrl(locale, '/compare'),
      },
    ],
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t('title'),
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: APPS.length,
    itemListElement: APPS.map((app, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t(`${app.key}.name`),
      description: t(`${app.key}.description`),
    })),
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

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'MotoVault',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: ['iOS', 'Android'],
    description: t('app0.description'),
    url: BASE_URL,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  const dated = { date: COMPARE_CHECKED_DATE };

  return (
    <div className="mv-cmp-page">
      <CompareStyles />
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={itemListSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={softwareAppSchema} />

      {/* Hero: one condensed H1, the lede, then the store buttons. The check
          date is printed once, under the matrix. */}
      <header className={`mv-cmp-wrap ${COMPARE_SECTION.header}`}>
        <CompareBreadcrumb current={t('heroTitle')} underCompare={false} />
        <h1 className="mv-section-title">{t('heroTitle')}</h1>
        <p className="mv-section-sub">{t('heroSubtitle')}</p>
        {/* Comparison intent is decision intent: the store pair sits in the
            hero and at the closing CTA, nowhere in between. */}
        <div className="mt-10">
          <StoreButtons pageType={CtaPageType.Compare} placement={CtaPlacement.Hero} />
        </div>
      </header>

      {/* The matrix: ten apps across, nine features down, on the page surface.
          It starts inside the first viewport, so no entrance: a Read page
          gets no load choreography. */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.weight}`}>
        <h2 className="mv-h2">{t('matrixTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('matrixSubtitle')}</p>
        <div className="mt-8 overflow-x-auto">
          <table className="mv-table mv-cmp-table" style={{ minWidth: 880 }}>
            <thead>
              <tr>
                <th scope="col" className="is-sticky">
                  {t('headerFeature')}
                </th>
                {APPS.map((app) => (
                  <th
                    key={app.key}
                    scope="col"
                    className={app.key === 'app0' ? 'is-center is-mv' : 'is-center'}
                  >
                    {t(`${app.key}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map(({ labelKey, field }) => (
                <tr key={field}>
                  <th scope="row" className="is-sticky">
                    {t(labelKey)}
                  </th>
                  {APPS.map((app) => {
                    const mark = app[field] ? 'yes' : 'no';
                    return (
                      <td key={`${app.key}-${field}`} className="is-center">
                        <CompareMarkCell mark={mark} label={markLabels[mark]} />
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className="is-sticky">
                  {t('headerPricing')}
                </th>
                {APPS.map((app) => (
                  <td
                    key={`${app.key}-price`}
                    className={
                      app.key === 'app0' ? 'is-center mv-figure' : 'is-center mv-figure is-comp'
                    }
                    style={{ minWidth: 120 }}
                  >
                    {t(`${app.key}.price`)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mv-cmp-meta mt-5" style={{ maxWidth: '72ch' }}>
          {t('methodology', dated)}
        </p>
      </section>

      {/* The comparisons: every head-to-head, then the two guides. One list
          per app: the matrix already carries each app's price. */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <CompareLinkList ids={HEAD_TO_HEAD_IDS} heading={t('comparisonsTitle')} />
        <div className="mt-12">
          <CompareLinkList ids={GUIDE_IDS} />
        </div>
      </section>

      {/* The verdict: four questions as hairline rows */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.prose}`}>
        <h2 className="mv-h2">{t('verdictTitle')}</h2>
        <p className="mv-cmp-note mt-4">{t('verdictSubtitle')}</p>
        <ul className="mv-rows mt-10">
          {VERDICT_INDICES.map((n) => (
            <li key={n} className="mv-row mv-cmp-grid-row md:grid-cols-[240px_1fr]">
              <h3 className="mv-cmp-sub">{t(`verdict${n}Title`)}</h3>
              <p className="mv-cmp-body is-compact is-full">{t(`verdict${n}`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className={`mv-cmp-wrap ${COMPARE_SECTION.faq}`}>
        <CompareFaq items={faqItems} />
      </section>

      <FeatureCta pageType={CtaPageType.Compare} />
    </div>
  );
}
