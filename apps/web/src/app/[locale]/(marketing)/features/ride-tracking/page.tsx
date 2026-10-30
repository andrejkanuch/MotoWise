import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureContentPage } from '@/components/marketing/feature-content-page';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesRides');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/ride-tracking'),
      languages: getHreflangMap('/features/ride-tracking'),
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesRides"
      route="/features/ride-tracking"
      screenshots={[
        {
          src: '/screenshots/home-rides-expenses.png',
          alt: 'MotoVault ride list with distance and speed',
        },
        {
          src: '/images/marketing/mw/trip-detail-hero.png',
          alt: 'MotoVault ride detail with route map and elevation profile',
        },
      ]}
    />
  );
}
