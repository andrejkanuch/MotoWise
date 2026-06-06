import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureContentPage } from '@/components/marketing/feature-content-page';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';

export const revalidate = 3600;

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
          src: '/images/features/home.png',
          alt: 'MotoVault ride detail with route map and elevation profile',
        },
      ]}
      featureIcons={[
        'M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
        'M22 12h-4l-3 9L9 3l-3 9H2',
        'm8 3 4 8 5-5 5 15H2L8 3z',
      ]}
    />
  );
}
