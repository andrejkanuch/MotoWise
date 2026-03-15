import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('FeaturesGarage');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/features/garage-management`,
      languages: {
        en: `${BASE_URL}/features/garage-management`,
        es: `${BASE_URL}/es/features/garage-management`,
        de: `${BASE_URL}/de/features/garage-management`,
        fr: `${BASE_URL}/fr/features/garage-management`,
        it: `${BASE_URL}/it/features/garage-management`,
        'x-default': `${BASE_URL}/features/garage-management`,
      },
    },
  };
}

export default async function GarageManagementPage() {
  const t = await getTranslations('FeaturesGarage');

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
        item: `${BASE_URL}/features/garage-management`,
      },
    ],
  };

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MotoVault',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'iOS, Android',
    description: t('description'),
    url: BASE_URL,
    featureList: [t('multiBikeTitle'), t('nhtsaTitle'), t('historyTitle'), t('remindersTitle')],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const features = [
    { titleKey: 'multiBikeTitle', descKey: 'multiBikeDesc' },
    { titleKey: 'nhtsaTitle', descKey: 'nhtsaDesc' },
    { titleKey: 'historyTitle', descKey: 'historyDesc' },
    { titleKey: 'remindersTitle', descKey: 'remindersDesc' },
  ] as const;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={softwareAppSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-2">
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
