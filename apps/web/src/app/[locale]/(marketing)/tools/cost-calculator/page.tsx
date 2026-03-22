import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { CostCalculator } from './cost-calculator';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CostCalculator');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/tools/cost-calculator'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/tools/cost-calculator')]),
        ['x-default', `${BASE_URL}/tools/cost-calculator`],
      ]),
    },
  };
}

export default async function CostCalculatorPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CostCalculator');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${BASE_URL}/tools` },
      {
        '@type': 'ListItem',
        position: 3,
        name: t('title'),
        item: `${BASE_URL}/tools/cost-calculator`,
      },
    ],
  };

  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: t('title'),
    description: t('description'),
    url: `${BASE_URL}/tools/cost-calculator`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'All',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    provider: { '@type': 'Organization', name: 'MotoVault', url: BASE_URL },
  };

  const labels = {
    ridingProfile: t('ridingProfile'),
    bikeType: t('bikeType'),
    annualMileage: t('annualMileage'),
    fuelPriceLabel: t('fuelPriceLabel'),
    insuranceLabel: t('insuranceLabel'),
    maintenanceTier: t('maintenanceTier'),
    bikeTypes: {
      sport: t('bikeTypeSport'),
      cruiser: t('bikeTypeCruiser'),
      adventure: t('bikeTypeAdventure'),
      naked: t('bikeTypeNaked'),
      touring: t('bikeTypeTouring'),
    },
    maintenanceTiers: {
      basic: { label: t('maintenanceBasic'), desc: t('maintenanceBasicDesc') },
      moderate: { label: t('maintenanceModerate'), desc: t('maintenanceModerateDesc') },
      premium: { label: t('maintenancePremium'), desc: t('maintenancePremiumDesc') },
    },
    annualBreakdown: t('annualBreakdown'),
    fuel: t('fuel'),
    insurance: t('insurance'),
    maintenance: t('maintenance'),
    tires: t('tires'),
    registrationFees: t('registrationFees'),
    annualTotal: t('annualTotal'),
    costPerMile: t('costPerMile'),
    fiveYearProjection: t('fiveYearProjection'),
    monthlyAverage: t('monthlyAverage'),
    perMonth: t('perMonth'),
    shareResults: t('shareResults'),
    copyLink: t('copyLink'),
    trackActualCosts: t('trackActualCosts'),
    getEarlyAccess: t('getEarlyAccess'),
    perYear: t('perYear'),
    mpgAvg: t('mpgAvg'),
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={webAppSchema} />

      {/* Hero */}
      <section className="px-4 pb-8 pt-24 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            {t('heroTitle')} <span className="text-warm-400">{t('heroTitleAccent')}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* Calculator */}
      <CostCalculator labels={labels} />

      {/* SEO Content */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-neutral-50">{t('seoTitle1')}</h2>
          <div className="mt-6 space-y-4 text-neutral-400">
            <p>{t('seoP1')}</p>
            <p>{t('seoP2')}</p>
            <p>{t('seoP3')}</p>
          </div>

          <h2 className="mt-12 text-2xl font-bold text-neutral-50">{t('seoTitle2')}</h2>
          <p className="mt-4 text-neutral-400">{t('seoP4')}</p>
        </div>
      </section>
    </>
  );
}
