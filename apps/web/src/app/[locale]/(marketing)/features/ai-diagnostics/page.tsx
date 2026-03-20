import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureFlow } from '@/components/marketing/feature-showcase';
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

      {/* Visual Flow: How AI Diagnostics Work */}
      <FeatureFlow
        label="How It Works"
        title={t('howItWorksTitle')}
        steps={[
          {
            number: '01',
            title: t('step1Title'),
            description: t('step1Desc'),
            screenshot: {
              src: '/images/features/diagnose.png',
              alt: 'MotoVault AI diagnostics screen — tap Start New Diagnosis',
            },
          },
          {
            number: '02',
            title: t('step2Title'),
            description: t('step2Desc'),
            screenshot: {
              src: '/images/features/bike-details.png',
              alt: 'MotoVault bike details — AI analyzes your motorcycle',
            },
          },
          {
            number: '03',
            title: t('step3Title'),
            description: t('step3Desc'),
            screenshot: {
              src: '/images/features/alerts.png',
              alt: 'MotoVault maintenance alerts generated from AI diagnostics',
            },
          },
        ]}
      />

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
