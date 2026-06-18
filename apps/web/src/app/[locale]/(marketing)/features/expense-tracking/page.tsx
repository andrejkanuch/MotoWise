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
  const t = await getTranslations('FeaturesExpenses');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/expense-tracking'),
      languages: getHreflangMap('/features/expense-tracking'),
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesExpenses"
      route="/features/expense-tracking"
      screenshots={[
        {
          src: '/images/features/expenses.png',
          alt: 'MotoVault expense dashboard with category breakdown and cost-per-mile',
        },
        {
          src: '/images/features/home-dashboard.jpg',
          alt: 'MotoVault dashboard showing monthly spending trends',
        },
      ]}
      featureIcons={[
        'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
        'M18 20V10M12 20V4M6 20v-6',
        'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
      ]}
    />
  );
}
