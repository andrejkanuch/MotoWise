import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsRever');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-rever'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/compare/motovault-vs-rever')]),
        ['x-default', getCanonicalUrl('en', '/compare/motovault-vs-rever')],
      ]),
    },
  };
}

function Check() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald-400"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Cross() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral-600"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const FEATURES = [
  { key: 'featureMaintenance', mv: true, rv: false },
  { key: 'featureExpenses', mv: true, rv: false },
  { key: 'featureRides', mv: true, rv: true },
  { key: 'featureRoutes', mv: false, rv: true },
  { key: 'featureDiagnostics', mv: true, rv: false },
  { key: 'featureLearning', mv: true, rv: false },
  { key: 'featureCommunity', mv: false, rv: true },
  { key: 'featureOfflineMaps', mv: false, rv: 'pro' },
  { key: 'featureFriendTracker', mv: false, rv: true },
  { key: 'featureReminders', mv: true, rv: false },
] as const;

export default async function VsReverPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsRever');

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
        name: 'MotoVault vs REVER',
        item: getCanonicalUrl(locale, '/compare/motovault-vs-rever'),
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

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'MotoVault',
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: ['iOS', 'Android'],
    url: BASE_URL,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
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
            <Link href="/compare" className="transition-colors hover:text-neutral-300">
              Compare
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
              MotoVault vs REVER
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

      {/* Quick Verdict */}
      <section className="px-6">
        <div className="reveal-on-scroll mx-auto max-w-3xl rounded-xl border border-warm-500/30 bg-warm-500/5 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-warm-400">
            Quick Verdict
          </p>
          <p className="mt-3 text-neutral-300 leading-relaxed">{t('quickVerdict')}</p>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto mt-16 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Feature Comparison Table */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Feature by Feature
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('tableTitle')}
            </h2>
          </div>

          <div className="reveal-on-scroll overflow-hidden rounded-xl border border-neutral-800/60">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800/60 bg-neutral-900/80">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-neutral-300 sm:px-6">
                    MotoVault
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-neutral-300 sm:px-6">
                    REVER
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map(({ key, mv, rv }) => (
                  <tr
                    key={key}
                    className="border-b border-neutral-800/40 last:border-b-0 odd:bg-neutral-900/30"
                  >
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">{t(key)}</td>
                    <td className="px-4 py-3 text-center sm:px-6">
                      <span className="inline-flex items-center justify-center">
                        {mv === true ? <Check /> : <Cross />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center sm:px-6">
                      <span className="inline-flex items-center justify-center">
                        {rv === true ? (
                          <Check />
                        ) : rv === 'pro' ? (
                          <span className="text-xs font-medium text-emerald-400">Pro</span>
                        ) : (
                          <Cross />
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Where Each Wins */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          {/* MotoVault Wins */}
          <div className="reveal-on-scroll">
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                {t('mvWins')}
              </p>
            </div>
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <h3 className="font-semibold text-neutral-100">{t(`mvWin${i}.title`)}</h3>
                  <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                    {t(`mvWin${i}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* REVER Wins */}
          <div className="reveal-on-scroll">
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">
                {t('rvWins')}
              </p>
            </div>
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-5"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <h3 className="font-semibold text-neutral-100">{t(`rvWin${i}.title`)}</h3>
                  <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                    {t(`rvWin${i}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Pricing */}
      <section className="px-6 py-16 md:py-24">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            Pricing
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('pricing')}</p>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Verdict */}
      <section className="px-6 py-16 md:py-24">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            Final Verdict
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('verdict')}</p>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Related Comparisons */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-center text-xl font-bold text-neutral-50">
            Related Comparisons
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/compare"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                Best Motorcycle Apps 2026
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Full feature matrix and ranking of 10 motorcycle apps.
              </p>
            </Link>
            <Link
              href="/compare/motovault-vs-ridelog"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                MotoVault vs RideLog
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Maintenance-focused apps compared head to head.
              </p>
            </Link>
            <Link
              href="/compare/motovault-vs-calimoto"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                MotoVault vs Calimoto
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Navigation app vs all-in-one companion for riders.
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
