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
      related={['/features/garage-management', '/features/expense-tracking']}
    />
  );
}
