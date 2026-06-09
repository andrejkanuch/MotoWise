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
  const t = await getTranslations('FeaturesMaintenance');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/maintenance'),
      languages: getHreflangMap('/features/maintenance'),
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesMaintenance"
      route="/features/maintenance"
      screenshots={[
        {
          src: '/images/features/maintenance.png',
          alt: 'MotoVault maintenance log with service history and reminders',
        },
        {
          src: '/images/features/alerts.png',
          alt: 'MotoVault upcoming service reminders and overdue tasks',
        },
      ]}
      featureIcons={[
        'M14.7 6.3a4 4 0 0 0-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 0 0 5.6-5.6l-2.5 2.5-2.8-2.8 2.5-2.5z',
        'M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
        'M3 6h18M3 12h18M3 18h12',
      ]}
    />
  );
}
