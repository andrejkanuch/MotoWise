import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshotPair } from '@/components/marketing/feature-screenshot';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesProgress');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/progress-tracking'),
      languages: getHreflangMap('/features/progress-tracking'),
    },
  };
}

const FEATURE_ICONS = [
  // Badges — trophy
  'M8 21h8m-4-4v4m-2-8a6 6 0 01-6-6V4h4l2-3 2 3h4v3a6 6 0 01-6 6z',
  // Streaks — flame
  'M12 2c.5 3.5-1 6-3 8 1 2 3 3.5 3 6 0 3-2 5-5 5s-5-2-5-5c0-4 3-6 5-9 1.5 1 3.5 2 5-1z',
  // Scores — chart
  'M18 20V10m-6 10V4M6 20v-6',
];

export default async function ProgressTrackingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesProgress');

  const canonical = getCanonicalUrl(locale, '/features/progress-tracking');

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
      pageKey: '/features/progress-tracking',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Features', url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features/progress-tracking',
    ),
    buildFAQPage(faqItems, `${locale}/features/progress-tracking/faq`),
  );

  const features = [
    { titleKey: 'badgesTitle', descKey: 'badgesDesc' },
    { titleKey: 'streaksTitle', descKey: 'streaksDesc' },
    { titleKey: 'scoresTitle', descKey: 'scoresDesc' },
  ] as const;

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
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/features" className="transition-colors hover:text-neutral-300">
              Features
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
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link
              href="/features/progress-tracking"
              className="text-neutral-300"
              aria-current="page"
            >
              {t('title')}
            </Link>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Progress Tracking
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {t('heroSubtitle')}
          </p>
        </div>
      </section>

      {/* App Screenshots */}
      <FeatureScreenshotPair
        screenshots={[
          {
            src: '/images/features/home.png',
            alt: 'MotoVault dashboard with bike health score and progress overview',
          },
          {
            src: '/images/features/alerts.png',
            alt: 'MotoVault maintenance alerts and recommended learning content',
          },
        ]}
      />

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Features */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Stay Motivated
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              Track Every Milestone
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ titleKey, descKey }, index) => (
              <article
                key={titleKey}
                className="card-lift reveal-on-scroll group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-8 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(ellipse at 50% 0%, oklch(0.76 0.13 70 / 0.08), transparent 70%)',
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />

                <div className="relative z-10">
                  <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 text-warm-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="size-6"
                      aria-hidden="true"
                    >
                      <path d={FEATURE_ICONS[index]} />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-50">{t(titleKey)}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-300">{t(descKey)}</p>
                </div>
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

      {/* Long-form Content */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Under the Hood
          </p>
          <h2 className="reveal-on-scroll text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('longFormTitle')}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-300">{t('longFormIntro')}</p>

          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />
          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormDashboardTitle')}</h3>
          <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormDashboard')}</p>

          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />
          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormRemindersTitle')}</h3>
          <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormReminders')}</p>

          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />
          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormAnalyticsTitle')}</h3>
          <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormAnalytics')}</p>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* FAQ */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Got Questions?
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="flex flex-col gap-2">
            {faqItems.map(({ question, answer }, index) => (
              <details
                key={question}
                className="group border-b border-neutral-800/50"
                open={index === 0}
              >
                <summary className="flex min-h-[44px] cursor-pointer items-center gap-3 py-4 text-left text-neutral-400 transition-colors hover:text-neutral-200 group-open:text-neutral-50 [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-medium text-warm-500">
                    {String(index + 1).padStart(2, '0')}.
                  </span>
                  <span className="text-lg font-medium">{question}</span>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto shrink-0 text-neutral-500 transition-transform duration-300 group-open:rotate-180"
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <div className="pb-4 pl-4 text-base leading-7 text-neutral-300 lg:max-w-2xl">
                  {answer}
                </div>
              </details>
            ))}
          </div>

          <p className="mt-12 text-center text-neutral-500">
            Have more questions?{' '}
            <Link
              href="/support"
              className="text-warm-400 underline underline-offset-4 transition-colors hover:text-warm-300"
            >
              Visit our support page
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
