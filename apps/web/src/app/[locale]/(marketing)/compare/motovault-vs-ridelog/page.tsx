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
  const t = await getTranslations('VsRideLog');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/motovault-vs-ridelog'),
      languages: getHreflangMap('/compare/motovault-vs-ridelog'),
    },
  };
}

const FEATURES = [
  { key: 'featureMaintenance', mv: true, rl: true },
  { key: 'featureExpenses', mv: true, rl: true },
  { key: 'featureRides', mv: true, rl: true },
  { key: 'featureAutoDetect', mv: false, rl: true },
  { key: 'featureDiagnostics', mv: true, rl: false },
  { key: 'featureLearning', mv: true, rl: false },
  { key: 'featureMultiBike', mv: true, rl: true },
  { key: 'featureReminders', mv: true, rl: true },
  { key: 'featureAndroid', mv: true, rl: false },
  { key: 'featureFindBike', mv: false, rl: true },
] as const;

const PARITY_ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const PRICING_ROWS = [0, 1, 2] as const;

export default async function VsRideLogPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('VsRideLog');

  const canonical = getCanonicalUrl(locale, '/compare/motovault-vs-ridelog');

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
      pageKey: '/compare/motovault-vs-ridelog',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Compare', url: getCanonicalUrl(locale, '/compare') },
        { name: 'MotoVault vs RideLog', url: canonical },
      ],
      locale,
      '/compare/motovault-vs-ridelog',
    ),
    buildFAQPage(faqItems, `${locale}/compare/motovault-vs-ridelog/faq`),
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
              MotoVault vs RideLog
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

      {/* Disambiguation */}
      <section className="px-6">
        <div className="mx-auto max-w-3xl rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-amber-400">
            {t('disambiguationTitle')}
          </p>
          <p className="mt-3 text-neutral-300 leading-relaxed">{t('disambiguationNote')}</p>
        </div>
      </section>

      {/* Testing preamble */}
      <section className="px-6 pt-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
            How we tested
          </p>
          <p className="mt-3 text-neutral-300 leading-relaxed">{t('testingPreamble')}</p>
        </div>
      </section>

      {/* Quick Verdict */}
      <section className="px-6 pt-10">
        <div className="reveal-on-scroll mx-auto max-w-4xl rounded-xl border border-warm-500/20 bg-warm-500/5 p-6 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-warm-400">
            Quick Verdict
          </p>
          <p className="mt-3 text-lg text-neutral-200 leading-relaxed">{t('quickVerdict')}</p>
        </div>
      </section>

      <div
        className="mx-auto mt-16 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Feature Comparison Table (existing) */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
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
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 md:px-6">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-warm-400 md:px-6">
                    MotoVault
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-neutral-300 md:px-6">
                    RideLog
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map(({ key, mv, rl }, i) => (
                  <tr key={key} className={i % 2 === 0 ? 'bg-neutral-900/30' : 'bg-neutral-900/50'}>
                    <td className="px-4 py-3 text-sm text-neutral-200 md:px-6">{t(key)}</td>
                    <td className="px-4 py-3 text-center md:px-6">
                      {mv ? (
                        <span className="text-emerald-400" role="img" aria-label="Yes">
                          &#10003;
                        </span>
                      ) : (
                        <span className="text-neutral-600" role="img" aria-label="No">
                          &#10005;
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center md:px-6">
                      {rl ? (
                        <span className="text-emerald-400" role="img" aria-label="Yes">
                          &#10003;
                        </span>
                      ) : (
                        <span className="text-neutral-600" role="img" aria-label="No">
                          &#10005;
                        </span>
                      )}
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

      {/* Where Each Wins */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div className="reveal-on-scroll">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('mvWins')}
            </p>
            <ul className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="rounded-xl border border-warm-500/20 bg-warm-500/5 p-4 text-sm leading-relaxed text-neutral-300"
                >
                  {t(`mvWin${i}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className="reveal-on-scroll">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              {t('rlWins')}
            </p>
            <ul className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-4 text-sm leading-relaxed text-neutral-300"
                >
                  {t(`rlWin${i}`)}
                </li>
              ))}
            </ul>
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
            {t('pricingTableTitle')}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800/60">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-neutral-800/60 bg-neutral-900/80">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('pricingHeaderPlan')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('pricingHeaderMv')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('pricingHeaderCompetitor')}
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
                      {t(`pricingRow${i}Plan`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`pricingRow${i}Mv`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`pricingRow${i}Competitor`)}
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

      {/* Parity matrix */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('parityMatrixTitle')}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-neutral-800/60">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b border-neutral-800/60 bg-neutral-900/80">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('parityHeaderFeature')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('parityHeaderMv')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('parityHeaderCompetitor')}
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-neutral-300 sm:px-6">
                    {t('parityHeaderNotes')}
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
                      {t(`parityRow${i}Feature`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`parityRow${i}Mv`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300 sm:px-6">
                      {t(`parityRow${i}Competitor`)}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400 sm:px-6">
                      {t(`parityRow${i}Notes`)}
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

      {/* When to choose competitor */}
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

      {/* Pricing narrative */}
      <section className="px-6 py-16 md:py-24">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            Pricing
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('pricing')}</p>
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
            Final Verdict
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('verdict')}</p>
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
              href="/compare/motovault-vs-rever"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                MotoVault vs REVER
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                How MotoVault compares to the popular REVER ride-tracking app.
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
                Navigation-focused Calimoto vs all-in-one MotoVault.
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
