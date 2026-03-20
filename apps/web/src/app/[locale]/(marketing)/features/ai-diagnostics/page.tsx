import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshot } from '@/components/marketing/feature-screenshot';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { DiagnosticsFaq } from './diagnostics-faq';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesDiagnostics');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/ai-diagnostics'),
      languages: {
        en: `${BASE_URL}/features/ai-diagnostics`,
        es: `${BASE_URL}/es/features/ai-diagnostics`,
        de: `${BASE_URL}/de/features/ai-diagnostics`,
        fr: `${BASE_URL}/fr/features/ai-diagnostics`,
        it: `${BASE_URL}/it/features/ai-diagnostics`,
        'x-default': `${BASE_URL}/features/ai-diagnostics`,
      },
    },
  };
}

export default async function AiDiagnosticsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesDiagnostics');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: t('title'),
        item: `${BASE_URL}/features/ai-diagnostics`,
      },
    ],
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
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  const issues = [
    'issue1',
    'issue2',
    'issue3',
    'issue4',
    'issue5',
    'issue6',
    'issue7',
    'issue8',
  ] as const;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      {/* Breadcrumb nav */}
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
            <Link href="/features/ai-diagnostics" className="text-neutral-300" aria-current="page">
              {t('title')}
            </Link>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            AI-Powered
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <div className="mx-auto mt-6 h-1 w-24 rounded-full bg-signature-500" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* App Screenshot */}
      <FeatureScreenshot
        src="/images/features/diagnose.png"
        alt="MotoVault AI diagnostics screen showing photo-based motorcycle issue detection"
      />

      {/* How It Works */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-7xl">
          {/* Section header */}
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Three Simple Steps
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('howItWorksTitle')}
            </h2>
          </div>

          {/* Steps */}
          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-8">
            {/* Connector lines (desktop only) */}
            <div
              className="pointer-events-none absolute inset-x-0 top-[44px] hidden md:block"
              aria-hidden="true"
            >
              <div className="mx-auto flex max-w-[66%] items-center">
                <div
                  className="draw-line h-[2px] flex-1 bg-neutral-700"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, currentColor 0, currentColor 8px, transparent 8px, transparent 14px)',
                    color: 'var(--color-neutral-700)',
                  }}
                />
              </div>
            </div>

            {(['step1', 'step2', 'step3'] as const).map((step, i) => (
              <div
                key={step}
                className="reveal-on-scroll relative flex flex-col items-center text-center"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Numbered circle */}
                <div className="step-circle mb-8 flex size-[88px] items-center justify-center rounded-full bg-gradient-to-br from-warm-400 to-signature-600 p-[2px]">
                  <div className="flex size-full flex-col items-center justify-center gap-0.5 rounded-full bg-neutral-950">
                    <span className="text-xl font-bold leading-none text-neutral-50">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Card */}
                <div className="card-lift w-full rounded-xl bg-neutral-900/30 p-8 shadow-[0_1px_0_0_oklch(1_0_0/0.04)]">
                  <h3 className="text-lg font-semibold text-neutral-50">{t(`${step}Title`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                    {t(`${step}Desc`)}
                  </p>
                </div>
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

      {/* Supported Issues */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-7xl">
          {/* Section header */}
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Comprehensive Coverage
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('issuesTitle')}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {issues.map((issue, index) => (
              <div
                key={issue}
                className="card-lift reveal-on-scroll rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <p className="text-neutral-300 leading-relaxed">{t(issue)}</p>
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

      {/* Long-form Content */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Deep Dive
          </p>
          <h2 className="reveal-on-scroll text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('longFormTitle')}
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('longFormIntro')}</p>

          {/* Visual break */}
          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />

          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormHowTitle')}</h3>
          <p className="mt-4 text-neutral-300 leading-relaxed">{t('longFormHow')}</p>

          {/* Visual break */}
          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />

          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormExamplesTitle')}</h3>
          <p className="mt-4 text-neutral-300 leading-relaxed">{t('longFormExamples')}</p>

          {/* Visual break */}
          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />

          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormComparisonTitle')}</h3>
          <p className="mt-4 text-neutral-300 leading-relaxed">{t('longFormComparison')}</p>
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
          {/* Section header */}
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Got Questions?
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>

          <DiagnosticsFaq
            items={faqItems}
            supportLabel="Have more questions?"
            supportLink={
              <Link
                href="/support"
                className="text-warm-400 underline underline-offset-4 transition-colors hover:text-warm-300"
              >
                Visit our support page
              </Link>
            }
          />
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
