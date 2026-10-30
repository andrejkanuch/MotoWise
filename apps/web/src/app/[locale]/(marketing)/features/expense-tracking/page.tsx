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
          src: '/images/marketing/mw/flow-add-expense.png',
          alt: 'MotoVault expense dashboard with category breakdown and cost-per-mile',
        },
        {
          src: '/images/marketing/mw/expense-insights.png',
          alt: 'MotoVault dashboard showing monthly spending trends',
        },
      ]}
      related={['/features/maintenance', '/features/ride-tracking']}
    />
  );
}
