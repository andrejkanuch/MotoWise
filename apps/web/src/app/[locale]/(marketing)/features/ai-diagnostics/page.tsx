import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('FeaturesDiagnostics');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/features/ai-diagnostics`,
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

export default async function AiDiagnosticsPage() {
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

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('heroTitle'),
    description: t('description'),
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: t('step1Title'),
        text: t('step1Desc'),
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: t('step2Title'),
        text: t('step2Desc'),
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: t('step3Title'),
        text: t('step3Desc'),
      },
    ],
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
      <JsonLd data={howToSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('howItWorksTitle')}
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {(['step1', 'step2', 'step3'] as const).map((step, i) => (
              <div
                key={step}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-warm-400/10 text-lg font-bold text-warm-400">
                  {i + 1}
                </div>
                <h3 className="text-xl font-bold text-neutral-50">{t(`${step}Title`)}</h3>
                <p className="mt-2 text-neutral-400">{t(`${step}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Issues */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('issuesTitle')}
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {issues.map((issue) => (
              <div
                key={issue}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6"
              >
                <p className="text-neutral-300">{t(issue)}</p>
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
