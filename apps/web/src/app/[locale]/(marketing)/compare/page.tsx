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
  MarkGlyph,
} from '@/components/marketing/compare-page';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { StoreButtons } from '@/components/marketing/store-buttons';
import { Link } from '@/i18n/navigation';
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

const APPS = [
  {
    key: 'app0',
    maintenance: true,
    expenses: true,
    rides: true,
    diagnostics: true,
    learning: true,
    multiBike: true,
    reminders: true,
    // Trip planning (multi-day routes, 11 typed waypoints, rider RSVPs, real road
    // routing) is a shipped feature — see /features/trip-planning. Treat it as
    // route planning for the top-level matrix; the per-competitor pages surface
    // the nuance that we don't do bend-weighted curvy-road turn-by-turn.
    routes: true,
    free: true,
  },
  {
    key: 'app1',
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
] as const;

// Row order = differentiation priority. Lead with the jobs riders actually pay
// for (expense tracking is the #1 paid feature; maintenance + reminders next),
// then the ride/route/garage basics. AI diagnostics + learning sit near the
// bottom — they're supporting features, not the headline (a lead-with-AI matrix
// over-indexed on a low-intent differentiator). FEATURES (i18n keys) and
// FEATURE_KEYS (APPS booleans) are zipped by index, so they MUST stay in sync.
const FEATURES = [
  'featureExpenses',
  'featureMaintenance',
  'featureReminders',
  'featureRides',
  'featureRoutes',
  'featureMultiBike',
  'featureLearning',
  'featureDiagnostics',
  'featureFree',
] as const;

const FEATURE_KEYS = [
  'expenses',
  'maintenance',
  'reminders',
  'rides',
  'routes',
  'multiBike',
  'learning',
  'diagnostics',
  'free',
] as const;

// Deep links from each ranked app to its in-depth head-to-head page. This wires
// the hub (/compare) to its spokes (/compare/motovault-vs-*) for internal-link
// equity + discovery. Apps without a dedicated comparison page are omitted.
const VS_PAGE_SLUG: Record<string, string> = {
  app1: 'motovault-vs-ridelog',
  app2: 'motovault-vs-rever',
  app3: 'motovault-vs-calimoto',
  app4: 'motovault-vs-motormanage',
  app5: 'motovault-vs-moto-shed',
  app7: 'motovault-vs-eatsleepride',
  app8: 'motovault-vs-scenic',
  app9: 'motovault-vs-motoscan',
};

const RELATED_LINKS = [
  {
    href: '/compare/motovault-vs-kurviger',
    title: 'MotoVault vs Kurviger',
    description: 'All-in-one companion vs curvy-road navigation — features and pricing compared.',
  },
  {
    href: '/compare/alternatives',
    title: 'Motorcycle App Alternatives',
    description: 'Switching from REVER, RideLog, or Calimoto? See how alternatives compare.',
  },
  {
    href: '/compare/maintenance-vs-ride-apps',
    title: 'Maintenance Apps vs. Ride Trackers',
    description: 'Two categories, two jobs. Do you need both? Find out.',
  },
] as const;

export default async function ComparePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Compare');

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

  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
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

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={itemListSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={softwareAppSchema} />

      {/* Hero — one condensed H1, left-aligned */}
      <header className="mx-auto max-w-6xl px-6 pt-28 md:pt-32">
        <CompareBreadcrumb items={[{ label: 'Home', href: '/' }, { label: t('heroTitle') }]} />
        <h1 className="mt-8" style={compareH1Style}>
          {t('heroTitle')}
        </h1>
        <p className="mt-6" style={{ ...compareBodyStyle, fontSize: 17, maxWidth: '58ch' }}>
          {t('heroSubtitle')}
        </p>
        {/* Above-the-fold store CTA — this is a money page (comparison intent);
            capture the decision before the reader scrolls the matrix. */}
        <div className="mt-8">
          <StoreButtons pageType={CtaPageType.Compare} placement={CtaPlacement.Hero} />
        </div>
        <p className="mt-4" style={{ fontSize: 13, color: 'var(--mv-ink-4)' }}>
          {t('updatedAt')}
        </p>
      </header>

      {/* Feature matrix — hairline spec table on the page surface */}
      <section className="mx-auto max-w-6xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('matrixTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}>
          {t('matrixSubtitle')}
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10"
                  style={{
                    background: 'var(--mv-bg)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--mv-ink-3)',
                    textAlign: 'left',
                    padding: '0 20px 10px 0',
                    borderBottom: '1px solid var(--mv-line-step)',
                  }}
                >
                  Feature
                </th>
                {APPS.map((app) => (
                  <th
                    key={app.key}
                    style={{
                      fontSize: 13,
                      fontWeight: app.key === 'app0' ? 600 : 500,
                      color: app.key === 'app0' ? 'var(--mv-ink)' : 'var(--mv-ink-3)',
                      textAlign: 'center',
                      padding: '0 10px 10px',
                      borderBottom: '1px solid var(--mv-line-step)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(`${app.key}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((featureKey, fi) => (
                <tr key={featureKey}>
                  <td
                    className="sticky left-0 z-10"
                    style={{
                      background: 'var(--mv-bg)',
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--mv-ink)',
                      padding: '12px 20px 12px 0',
                      borderBottom: '1px solid var(--mv-line)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(featureKey)}
                  </td>
                  {APPS.map((app) => (
                    <td
                      key={`${app.key}-${featureKey}`}
                      style={{
                        textAlign: 'center',
                        padding: '12px 10px',
                        borderBottom: '1px solid var(--mv-line)',
                      }}
                    >
                      <span className="inline-flex justify-center">
                        <MarkGlyph mark={app[FEATURE_KEYS[fi]] ? 'yes' : 'no'} />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              {/* Pricing row — condensed tabular figures */}
              <tr>
                <td
                  className="sticky left-0 z-10"
                  style={{
                    background: 'var(--mv-bg)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--mv-ink)',
                    padding: '12px 20px 12px 0',
                    borderBottom: '1px solid var(--mv-line)',
                  }}
                >
                  Pricing
                </td>
                {APPS.map((app) => (
                  <td
                    key={`${app.key}-price`}
                    style={{
                      textAlign: 'center',
                      padding: '12px 10px',
                      borderBottom: '1px solid var(--mv-line)',
                      fontFamily: 'var(--mv-font-display)',
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 14,
                      color: 'var(--mv-ink-2)',
                    }}
                  >
                    {t(`${app.key}.price`)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4" style={{ fontSize: 13, color: 'var(--mv-ink-4)', maxWidth: '80ch' }}>
          {t('methodology')}
        </p>
      </section>

      {/* Ranked apps — hairline rows, no cards */}
      <section className="mx-auto max-w-6xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('appsTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}>
          {t('appsSubtitle')}
        </p>

        <div className="mt-10" style={{ borderBottom: '1px solid var(--mv-line)' }}>
          {APPS.map((app, index) => (
            <article
              key={app.key}
              className="grid gap-x-8 gap-y-4 py-10 md:grid-cols-[64px_1fr]"
              style={{ borderTop: '1px solid var(--mv-line)' }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--mv-font-display)',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 34,
                  lineHeight: 1,
                  color: 'var(--mv-ink-4)',
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <div className="flex flex-col gap-x-6 gap-y-2 md:flex-row md:items-baseline md:justify-between">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 style={compareH3Style}>{t(`${app.key}.name`)}</h3>
                    {app.key === 'app0' && (
                      <span
                        style={{ color: 'var(--mv-copper-text)', fontSize: 13, fontWeight: 600 }}
                      >
                        Our pick
                      </span>
                    )}
                    <span style={{ fontSize: 14, color: 'var(--mv-ink-3)' }}>
                      {t(`${app.key}.tagline`)}
                    </span>
                  </div>
                  <div className="shrink-0 md:text-right">
                    <p
                      style={{
                        fontFamily: 'var(--mv-font-display)',
                        fontWeight: 500,
                        fontVariantNumeric: 'tabular-nums',
                        fontSize: 15,
                        color: 'var(--mv-ink)',
                        margin: 0,
                      }}
                    >
                      {t(`${app.key}.price`)}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--mv-ink-4)', margin: '2px 0 0' }}>
                      {t(`${app.key}.platforms`)}
                    </p>
                  </div>
                </div>
                <p className="mt-3" style={{ ...compareBodyStyle, fontSize: 15 }}>
                  {t(`${app.key}.description`)}
                </p>
                <p
                  className="mt-2"
                  style={{ fontSize: 14, fontWeight: 500, color: 'var(--mv-ink-2)' }}
                >
                  {t(`${app.key}.best`)}
                </p>

                <div className="mt-5 grid gap-x-12 gap-y-4 sm:grid-cols-2">
                  <div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--mv-ink-3)',
                        margin: '0 0 6px',
                      }}
                    >
                      Pros
                    </p>
                    <ul className="space-y-1.5">
                      {t(`${app.key}.pros`)
                        .split(', ')
                        .map((pro) => (
                          <li
                            key={pro}
                            className="flex items-start gap-2"
                            style={{ fontSize: 14, color: 'var(--mv-ink-2)' }}
                          >
                            <MarkGlyph mark="yes" />
                            {pro}
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--mv-ink-3)',
                        margin: '0 0 6px',
                      }}
                    >
                      Cons
                    </p>
                    <ul className="space-y-1.5">
                      {t(`${app.key}.cons`)
                        .split(', ')
                        .map((con) => (
                          <li
                            key={con}
                            className="flex items-start gap-2"
                            style={{ fontSize: 14, color: 'var(--mv-ink-2)' }}
                          >
                            <MarkGlyph mark="no" />
                            {con}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>

                {VS_PAGE_SLUG[app.key] ? (
                  <Link
                    href={`/compare/${VS_PAGE_SLUG[app.key]}`}
                    className="mt-5 inline-flex items-center gap-1.5 transition-colors"
                    style={{ color: 'var(--mv-copper-text)', fontSize: 14, fontWeight: 600 }}
                  >
                    MotoVault vs {t(`${app.key}.name`)} — full comparison
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
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Verdict — plain two-column Q&A, no cards */}
      <section className="mx-auto max-w-6xl px-6 pt-20 md:pt-28">
        <h2 style={compareH2Style}>{t('verdictTitle')}</h2>
        <p className="mt-4" style={{ ...compareBodyStyle, fontSize: 15, color: 'var(--mv-ink-3)' }}>
          {t('verdictSubtitle')}
        </p>

        <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="pt-4" style={{ borderTop: '1px solid var(--mv-line)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--mv-ink)', margin: 0 }}>
                {t(`verdict${n}Title`)}
              </h3>
              <p className="mt-2" style={{ ...compareBodyStyle, fontSize: 14, maxWidth: 'none' }}>
                {t(`verdict${n}`)}
              </p>
            </div>
          ))}
        </div>

        {/* Decision-moment CTA — the reader has just read the verdict; capture
            the download here rather than only at the page-end FeatureCta. */}
        <div className="mt-12 flex flex-col items-start gap-4">
          <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--mv-ink)', margin: 0 }}>
            {t('verdictCtaTitle')}
          </p>
          <StoreButtons pageType={CtaPageType.Compare} placement={CtaPlacement.MidArticle} />
        </div>
      </section>

      {/* Related comparisons — plain links */}
      <section className="mx-auto max-w-6xl px-6 pt-20 md:pt-28">
        <CompareRelatedLinks links={RELATED_LINKS} />
      </section>

      {/* FAQ — hairline details */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
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
