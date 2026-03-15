import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('FeaturesProgress');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/features/progress-tracking`,
      languages: {
        en: `${BASE_URL}/features/progress-tracking`,
        es: `${BASE_URL}/es/features/progress-tracking`,
        de: `${BASE_URL}/de/features/progress-tracking`,
        fr: `${BASE_URL}/fr/features/progress-tracking`,
        it: `${BASE_URL}/it/features/progress-tracking`,
        'x-default': `${BASE_URL}/features/progress-tracking`,
      },
    },
  };
}

export default async function ProgressTrackingPage() {
  const t = await getTranslations('FeaturesProgress');

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
        item: `${BASE_URL}/features/progress-tracking`,
      },
    ],
  };

  const features = [
    { titleKey: 'badgesTitle', descKey: 'badgesDesc' },
    { titleKey: 'streaksTitle', descKey: 'streaksDesc' },
    { titleKey: 'scoresTitle', descKey: 'scoresDesc' },
  ] as const;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-3">
            {features.map(({ titleKey, descKey }) => (
              <div
                key={titleKey}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8"
              >
                <h2 className="text-xl font-bold text-neutral-50">{t(titleKey)}</h2>
                <p className="mt-3 text-neutral-400">{t(descKey)}</p>
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
