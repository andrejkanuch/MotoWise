import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareAlternatives');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/alternatives'),
      languages: getHreflangMap('/compare/alternatives'),
    },
  };
}

const ALT_INDICES = [0, 1, 2, 3, 4, 5] as const;
const BEST_FOR_INDICES = [0, 1, 2, 3, 4] as const;
const PRICING_ROWS = [0, 1, 2, 3, 4] as const;

export default async function AlternativesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareAlternatives');

  const canonical = getCanonicalUrl(locale, '/compare/alternatives');

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
      pageKey: '/compare/alternatives',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'Alternatives', url: canonical },
      ],
      locale,
      '/compare/alternatives',
    ),
    buildFAQPage(faqItems, `${locale}/compare/alternatives/faq`),
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
              Alternatives
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

      {/* Testing preamble */}
      <section className="px-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
            How we tested
          </p>
          <p className="mt-3 text-neutral-300 leading-relaxed">{t('testingPreamble')}</p>
        </div>
      </section>

      {/* Best-for guide */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('bestForTitle')}
          </h2>
          <div className="space-y-6">
            {BEST_FOR_INDICES.map((i) => (
              <article
                key={i}
                className="reveal-on-scroll rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 md:p-8"
              >
                <h3 className="text-xl font-bold text-neutral-50">{t(`bestFor${i}Title`)}</h3>
                <p className="mt-3 text-neutral-300 leading-relaxed">{t(`bestFor${i}Body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Pricing table */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('pricingTableTitle')}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800/60">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-neutral-800/60 bg-neutral-900/80">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('pricingHeaderApp')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('pricingHeaderFree')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('pricingHeaderPaid')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('pricingHeaderNotes')}
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
                      {t(`pricingRow${i}App`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`pricingRow${i}Free`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`pricingRow${i}Paid`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400 sm:px-6">
                      {t(`pricingRow${i}Notes`)}
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

      {/* Existing Alternatives Cards */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('altToTitle')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('altToSubtitle')}
            </h2>
          </div>

          <div className="space-y-6">
            {ALT_INDICES.map((i) => (
              <article
                key={i}
                id={t(`alt${i}.appName`).toLowerCase().replace(/\s+/g, '-')}
                className="reveal-on-scroll rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 md:p-8 transition-colors hover:border-neutral-700/60"
              >
                <h3 className="text-xl font-bold text-neutral-50">{t(`alt${i}.title`)}</h3>
                <p className="mt-3 text-neutral-300 leading-relaxed">{t(`alt${i}.why`)}</p>
                <div className="mt-4 rounded-lg border border-warm-500/20 bg-warm-500/5 p-4">
                  <p className="text-sm font-medium text-warm-400">Consider MotoVault</p>
                  <p className="mt-1 text-sm text-neutral-300 leading-relaxed">
                    {t(`alt${i}.consider`)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* When to choose a specialist */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('whenToChooseCompetitorTitle')}
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">
            {t('whenToChooseCompetitor')}
          </p>
        </div>
      </section>

      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Why Riders Switch */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('switchTitle')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('switchSubtitle')}
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="reveal-on-scroll rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-warm-500/10">
                  <span className="text-lg font-bold text-warm-400">{i + 1}</span>
                </div>
                <h3 className="font-semibold text-neutral-50">{t(`switch${i}.title`)}</h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  {t(`switch${i}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
          <div className="grid gap-4 sm:grid-cols-2">
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
              href="/compare/maintenance-vs-ride-apps"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                Maintenance Apps vs. Ride Trackers
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Two categories, two jobs. Do you need both?
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

      <FeatureCta />
    </>
  );
}
