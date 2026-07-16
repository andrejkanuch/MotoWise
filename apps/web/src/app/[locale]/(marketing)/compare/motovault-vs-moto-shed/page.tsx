import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { CtaPageType } from '@/lib/cta-taxonomy';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsMotoShed');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-moto-shed'),
      languages: getHreflangMap('/compare/motovault-vs-moto-shed'),
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
  { key: 'featureMaintenance', mv: true, comp: true },
  { key: 'featureExpenses', mv: true, comp: true },
  { key: 'featureReminders', mv: true, comp: true },
  { key: 'featureDiagnostics', mv: true, comp: false },
  { key: 'featureTripPlanning', mv: true, comp: false },
  { key: 'featureRouteDiscovery', mv: true, comp: false },
  { key: 'featureLearning', mv: true, comp: false },
  { key: 'featureMultiBike', mv: true, comp: true },
  { key: 'featureAndroid', mv: true, comp: false },
  { key: 'featureRides', mv: true, comp: false },
] as const;

const PARITY_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const PRICING_ROWS = [0, 1, 2] as const;

export default async function VsMotoShedPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsMotoShed');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-moto-shed');

  const faqItems = [0, 1, 2, 3].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/compare/motovault-vs-moto-shed',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs Moto Shed', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-moto-shed',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-moto-shed/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

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
              MotoVault vs Moto Shed
            </span>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('h1')}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* App descriptions */}
      <section className="px-6">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-warm-500/20 bg-warm-500/5 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-warm-400">{t('mvHeading')}</h2>
            <p className="mt-3 text-neutral-300 leading-relaxed">{t('mvDescription')}</p>
          </div>
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-neutral-300">{t('compHeading')}</h2>
            <p className="mt-3 text-neutral-300 leading-relaxed">{t('compDescription')}</p>
          </div>
        </div>
      </section>

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
              Side-by-Side Comparison
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
                    Moto Shed
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map(({ key, mv, comp }) => (
                  <tr
                    key={key}
                    className="border-b border-neutral-800/40 last:border-b-0 odd:bg-neutral-900/30"
                  >
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">{t(key)}</td>
                    <td className="px-4 py-3 text-center sm:px-6">
                      <span className="inline-flex items-center justify-center">
                        {mv ? <Check /> : <Cross />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center sm:px-6">
                      <span className="inline-flex items-center justify-center">
                        {comp ? <Check /> : <Cross />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Parity matrix */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            Detailed Feature Comparison
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800/60">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-800/60 bg-neutral-900/80">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    MotoVault
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    Moto Shed
                  </th>
                </tr>
              </thead>
              <tbody>
                {PARITY_ROWS.map((i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-800/40 last:border-b-0 odd:bg-neutral-900/30 align-top"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-neutral-200 sm:px-6">
                      {t(`parity.${i}.label`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`parity.${i}.mv`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`parity.${i}.comp`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Pricing table */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            Pricing
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800/60">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-800/60 bg-neutral-900/80">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    MotoVault
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    Moto Shed
                  </th>
                </tr>
              </thead>
              <tbody>
                {PRICING_ROWS.map((i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-800/40 last:border-b-0 odd:bg-neutral-900/30 align-top"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-neutral-200 sm:px-6">
                      {t(`pricing.${i}.label`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`pricing.${i}.mv`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`pricing.${i}.comp`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Verdict */}
      <section className="px-6 py-16 md:py-24">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('verdictHeading')}
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('verdictText')}</p>
        </div>
      </section>

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
              href="/compare/motovault-vs-motormanage"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                MotoVault vs MotorManage
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                All-in-one platform vs OEM service schedule specialist.
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
                Full-featured companion vs automatic ride detection.
              </p>
            </Link>
          </div>
        </div>
      </section>

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

      <FeatureCta pageType={CtaPageType.Compare} />
    </>
  );
}
