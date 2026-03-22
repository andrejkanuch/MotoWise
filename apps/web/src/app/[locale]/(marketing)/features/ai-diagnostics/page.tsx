import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DiagnosticFlowStepper } from '@/components/marketing/diagnostic-flow-stepper';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
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
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/features/ai-diagnostics')]),
        ['x-default', getCanonicalUrl('en', '/features/ai-diagnostics')],
      ]),
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
      { '@type': 'ListItem', position: 1, name: 'Home', item: getCanonicalUrl(locale) },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Features',
        item: getCanonicalUrl(locale, '/features'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: t('title'),
        item: getCanonicalUrl(locale, '/features/ai-diagnostics'),
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
      acceptedAnswer: { '@type': 'Answer', text: answer },
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

  const issueIcons = [
    // Warning lights
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
    // Engine
    'M12 8V4H8 M2 14h2 M20 14h2 M15 13a5 5 0 00-6 0 M8.21 13.89L7 23 M15.79 13.89L17 23 M12 13a1 1 0 100-2 1 1 0 000 2z',
    // Electrical
    'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    // Brakes
    'M12 22a10 10 0 100-20 10 10 0 000 20z M12 16a4 4 0 100-8 4 4 0 000 8z',
    // Chain
    'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71 M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
    // Tires
    'M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v12 M6 12h12',
    // Fluids
    'M12 2.69l5.66 5.66a8 8 0 11-11.31 0z',
    // Corrosion
    'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  ];

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

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
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            AI-Powered
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

      {/* Interactive Diagnostic Flow */}
      <DiagnosticFlowStepper
        sectionLabel="How It Works"
        sectionTitle={t('howItWorksTitle')}
        steps={[
          {
            number: '1',
            label: t('step1Label'),
            title: t('step1Title'),
            description: t('step1Desc'),
            screenshot: '/images/features/diagnose-flow/step-1-select-bike.png',
            alt: 'MotoVault diagnostic step 1 — select your motorcycle from the garage',
          },
          {
            number: '2',
            label: t('step2Label'),
            title: t('step2Title'),
            description: t('step2Desc'),
            screenshot: '/images/features/diagnose-flow/step-2-symptoms.png',
            alt: 'MotoVault diagnostic step 2 — describe symptoms with guided wizard',
          },
          {
            number: '3',
            label: t('step3Label'),
            title: t('step3Title'),
            description: t('step3Desc'),
            screenshot: '/images/features/diagnose-flow/step-3-photo.png',
            alt: 'MotoVault diagnostic step 3 — add photo and set urgency',
          },
          {
            number: '4',
            label: t('step4Label'),
            title: t('step4Title'),
            description: t('step4Desc'),
            screenshot: '/images/features/diagnose-flow/step-4-analyzing.png',
            alt: 'MotoVault diagnostic step 4 — review details and start AI analysis',
          },
        ]}
        result={{
          title: t('resultTitle'),
          description: t('resultDesc'),
          screenshots: [
            {
              src: '/images/features/diagnose-flow/result-overview.png',
              alt: 'AI diagnosis result showing part identification, severity, and confidence',
            },
          ],
        }}
      />

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Result Deep Dive — multi-phone showcase */}
      <section className="reveal-on-scroll px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Detailed Results
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              What Your Diagnosis Includes
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-400">
              Every diagnosis delivers a structured report: part identification, severity
              assessment, probable causes with confidence percentages, required tools, difficulty
              rating, and actionable next steps.
            </p>
          </div>

          {/* Three phones showing result screens */}
          <div
            className="flex flex-col items-center justify-center gap-6 md:flex-row md:items-start md:gap-8 lg:gap-10"
            style={{ perspective: '1200px' }}
          >
            {[
              {
                src: '/images/features/diagnose-flow/result-overview.png',
                alt: 'Diagnosis result — part identified with severity and confidence',
                label: 'Diagnosis Overview',
                subtitle: 'Part ID, severity, and confidence score',
              },
              {
                src: '/images/features/diagnose-flow/result-issues.png',
                alt: 'Issues found with probability percentages and tools needed',
                label: 'Issues & Tools',
                subtitle: 'Probable causes ranked by likelihood',
              },
              {
                src: '/images/features/diagnose-flow/result-next-steps.png',
                alt: 'Step-by-step next actions and difficulty rating',
                label: 'Next Steps',
                subtitle: 'Actionable repair steps and difficulty',
              },
            ].map((shot, i) => (
              <div
                key={shot.src}
                className="reveal-on-scroll flex flex-col items-center gap-4"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div
                  className={`relative w-[240px] md:w-[260px] lg:w-[280px] ${i === 1 ? 'z-10' : 'z-0'}`}
                >
                  <div
                    className="relative rounded-[2.5rem] border-[6px] border-neutral-800 bg-neutral-900 p-1.5 shadow-2xl ring-1 ring-neutral-700/50 transition-transform duration-500 hover:-translate-y-2 hover:shadow-[0_20px_60px_oklch(0_0_0/0.5)]"
                    style={{
                      transform: i === 0 ? 'rotateY(3deg)' : i === 2 ? 'rotateY(-3deg)' : 'none',
                    }}
                  >
                    <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-neutral-800" />
                    <div className="overflow-hidden rounded-[2rem]">
                      <Image
                        src={shot.src}
                        alt={shot.alt}
                        width={1206}
                        height={2622}
                        className="block w-full"
                        sizes="220px"
                        loading="lazy"
                      />
                    </div>
                    <div className="mx-auto mt-1.5 h-1 w-16 rounded-full bg-neutral-700" />
                  </div>

                  <div
                    className="pointer-events-none absolute inset-0 -z-10 blur-3xl"
                    style={{
                      background:
                        'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.55 0.17 230 / 0.1), transparent)',
                    }}
                    aria-hidden="true"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-neutral-300">{shot.label}</p>
                  <p className="mt-1 text-xs text-neutral-500">{shot.subtitle}</p>
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
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Common Issues We Diagnose
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('issuesTitle')}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {issues.map((issue, index) => (
              <div
                key={issue}
                className="card-lift reveal-on-scroll group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-neutral-800/50 transition-colors group-hover:bg-warm-500/10">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-neutral-400 transition-colors group-hover:text-warm-400"
                    aria-hidden="true"
                  >
                    <path d={issueIcons[index]} />
                  </svg>
                </div>
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
            Under the Hood
          </p>
          <h2 className="reveal-on-scroll text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('longFormTitle')}
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('longFormIntro')}</p>

          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />
          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormHowTitle')}</h3>
          <p className="mt-4 text-neutral-300 leading-relaxed">{t('longFormHow')}</p>

          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />
          <h3 className="text-2xl font-semibold text-neutral-50">{t('longFormExamplesTitle')}</h3>
          <p className="mt-4 text-neutral-300 leading-relaxed">{t('longFormExamples')}</p>

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
