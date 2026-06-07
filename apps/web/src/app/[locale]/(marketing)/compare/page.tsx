import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';

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

const FEATURES = [
  'featureMaintenance',
  'featureExpenses',
  'featureRides',
  'featureDiagnostics',
  'featureLearning',
  'featureMultiBike',
  'featureReminders',
  'featureRoutes',
  'featureFree',
] as const;

const FEATURE_KEYS = [
  'maintenance',
  'expenses',
  'rides',
  'diagnostics',
  'learning',
  'multiBike',
  'reminders',
  'routes',
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

function Check() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-400"
      aria-label="Yes"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-600"
      aria-label="No"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

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

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="px-6 pt-20 md:pt-24">
        <ol className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="transition-colors hover:text-neutral-300">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-600"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <span className="text-neutral-300" aria-current="page">
              {t('heroTitle')}
            </span>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('heroLabel')}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {t('heroSubtitle')}
          </p>
          <p className="mt-4 text-sm text-neutral-500">{t('updatedAt')}</p>
        </div>
      </section>

      {/* Feature Matrix */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('matrixTitle')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('matrixSubtitle')}
            </h2>
          </div>

          <div className="overflow-x-auto rounded-xl border border-neutral-800/60">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-neutral-800/60 bg-neutral-900/80">
                  <th className="sticky left-0 z-10 bg-neutral-900/95 px-4 py-3 text-left font-semibold text-neutral-300 backdrop-blur-sm">
                    Feature
                  </th>
                  {APPS.map((app) => (
                    <th
                      key={app.key}
                      className={`px-3 py-3 text-center font-semibold ${app.key === 'app0' ? 'text-warm-400' : 'text-neutral-300'}`}
                    >
                      {t(`${app.key}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((featureKey, fi) => (
                  <tr
                    key={featureKey}
                    className="border-b border-neutral-800/30 transition-colors hover:bg-neutral-800/20"
                  >
                    <td className="sticky left-0 z-10 bg-neutral-950/95 px-4 py-3 font-medium text-neutral-300 backdrop-blur-sm">
                      {t(featureKey)}
                    </td>
                    {APPS.map((app) => (
                      <td
                        key={`${app.key}-${featureKey}`}
                        className={`px-3 py-3 text-center ${app.key === 'app0' ? 'bg-warm-500/5' : ''}`}
                      >
                        {app[FEATURE_KEYS[fi]] ? <Check /> : <Cross />}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Pricing row */}
                <tr className="border-b border-neutral-800/30 transition-colors hover:bg-neutral-800/20">
                  <td className="sticky left-0 z-10 bg-neutral-950/95 px-4 py-3 font-medium text-neutral-300 backdrop-blur-sm">
                    Pricing
                  </td>
                  {APPS.map((app) => (
                    <td
                      key={`${app.key}-price`}
                      className={`px-3 py-3 text-center text-xs text-neutral-400 ${app.key === 'app0' ? 'bg-warm-500/5' : ''}`}
                    >
                      {t(`${app.key}.price`)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-neutral-600">{t('methodology')}</p>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* App Cards */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('appsTitle')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('appsSubtitle')}
            </h2>
          </div>

          <div className="space-y-6">
            {APPS.map((app, index) => (
              <article
                key={app.key}
                className={`reveal-on-scroll rounded-xl border p-6 md:p-8 ${
                  app.key === 'app0'
                    ? 'border-warm-500/40 bg-warm-500/5'
                    : 'border-neutral-800/60 bg-neutral-900/50'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-800 text-xs font-bold text-neutral-400">
                        {index + 1}
                      </span>
                      <h3
                        className={`text-xl font-bold ${app.key === 'app0' ? 'text-warm-400' : 'text-neutral-50'}`}
                      >
                        {t(`${app.key}.name`)}
                      </h3>
                      {app.key === 'app0' && (
                        <span className="rounded-full bg-warm-500/20 px-2.5 py-0.5 text-xs font-semibold text-warm-400">
                          Our Pick
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-neutral-400">
                      {t(`${app.key}.tagline`)}
                    </p>
                    <p className="mt-3 text-neutral-300 leading-relaxed">
                      {t(`${app.key}.description`)}
                    </p>
                    <p className="mt-2 text-sm font-medium text-primary-400">
                      {t(`${app.key}.best`)}
                    </p>
                  </div>
                  <div className="shrink-0 md:text-right">
                    <p className="text-sm font-semibold text-neutral-300">
                      {t(`${app.key}.price`)}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">{t(`${app.key}.platforms`)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                      Pros
                    </p>
                    <ul className="space-y-1">
                      {t(`${app.key}.pros`)
                        .split(', ')
                        .map((pro) => (
                          <li key={pro} className="flex items-start gap-2 text-sm text-neutral-400">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 shrink-0 text-emerald-400"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {pro}
                          </li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-400/80">
                      Cons
                    </p>
                    <ul className="space-y-1">
                      {t(`${app.key}.cons`)
                        .split(', ')
                        .map((con) => (
                          <li key={con} className="flex items-start gap-2 text-sm text-neutral-400">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-0.5 shrink-0 text-red-400/60"
                              aria-hidden="true"
                            >
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            {con}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>

                {VS_PAGE_SLUG[app.key] ? (
                  <Link
                    href={`/compare/${VS_PAGE_SLUG[app.key]}`}
                    className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-warm-400 transition-colors hover:text-warm-300"
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
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Verdict */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('verdictTitle')}
            </h2>
            <p className="mt-4 text-lg text-neutral-400">{t('verdictSubtitle')}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="reveal-on-scroll rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6"
              >
                <h3 className="font-semibold text-neutral-50">{t(`verdict${n}Title`)}</h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{t(`verdict${n}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Related Pages */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-center text-xl font-bold text-neutral-50">
            Related Comparisons
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/compare/motovault-vs-kurviger"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                MotoVault vs Kurviger
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                All-in-one companion vs curvy-road navigation — features and pricing compared.
              </p>
            </Link>
            <Link
              href="/compare/alternatives"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                Motorcycle App Alternatives
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Switching from REVER, RideLog, or Calimoto? See how alternatives compare.
              </p>
            </Link>
            <Link
              href="/compare/maintenance-vs-ride-apps"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                Maintenance Apps vs. Ride Trackers
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Two categories, two jobs. Do you need both? Find out.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* FAQ */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Got Questions?
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-6">
            {faqItems.map(({ question, answer }) => (
              <div
                key={question}
                className="rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6"
              >
                <h3 className="font-semibold text-neutral-100">{question}</h3>
                <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
