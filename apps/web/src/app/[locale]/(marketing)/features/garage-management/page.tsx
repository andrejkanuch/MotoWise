import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BikePlate } from '@/components/marketing/bike-plate';
import { FeatureContentPage } from '@/components/marketing/feature-content-page';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/garage-management'),
      languages: getHreflangMap('/features/garage-management'),
    },
  };
}

const FEATURE_KEYS = ['multiBike', 'nhtsa', 'history', 'reminders'] as const;

const LONG_FORM_KEYS = ['MultiBike', 'Scheduling', 'Resale'] as const;

export default async function GarageManagementPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');

  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesGarage"
      route="/features/garage-management"
      screenshots={[
        {
          src: '/images/marketing/mw/garage.png',
          alt: 'MotoVault garage with every bike, its odometer and what is due next',
        },
        {
          src: '/images/marketing/mw/service-history.png',
          alt: 'MotoVault service history for one bike',
        },
      ]}
      heroVisual={
        // The feature-page family's one signature moment: the hero plate
        // settles and lays its stripe. The screenshot pair below keeps the
        // scroll reveal; the two never share an object.
        <BikePlate
          figure="14,820"
          unit="mi"
          caption={t('plateCaption')}
          racingNumber="07"
          identity={t('plateIdentity')}
          state="due"
          stateLabel={t('plateStateLabel')}
          settle
        />
      }
      features={{
        title: t('featuresTitle'),
        items: FEATURE_KEYS.map((key) => ({ title: t(`${key}Title`), desc: t(`${key}Desc`) })),
      }}
      longForm={{
        title: t('longFormTitle'),
        intro: t('longFormIntro'),
        sections: LONG_FORM_KEYS.map((key) => ({
          title: t(`longForm${key}Title`),
          body: t(`longForm${key}`),
        })),
      }}
      faqItems={[0, 1, 2, 3, 4].map((i) => ({
        question: t(`faq.${i}.question`),
        answer: t(`faq.${i}.answer`),
      }))}
    />
  );
}
