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
    // Message contains a <strong> tag and is rendered via dangerouslySetInnerHTML
    // in the client component, so use t.markup (returns an HTML string with the
    // tag applied). Plain t() throws a FORMATTING_ERROR on tag-bearing messages.
    trackActualCosts: t.markup('trackActualCosts', {
      strong: (chunks) => `<strong>${chunks}</strong>`,
    }),
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

      {/* Written guide */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-4">
        <h2 className="mb-6 text-2xl font-bold text-neutral-50">
          Understanding Motorcycle Cost of Ownership
        </h2>

        <p className="mb-6 text-base leading-relaxed text-neutral-300">
          The true cost of owning a motorcycle goes far beyond the purchase price and monthly fuel
          bill. Insurance, regular maintenance, tires, gear replacement, registration, and
          unexpected repairs all add up over a riding season. Understanding your total cost of
          ownership helps you budget accurately, compare bike options, and identify where you can
          save money without compromising safety.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">
          What This Calculator Covers
        </h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          This calculator estimates your annual motorcycle cost of ownership across six categories:
          fuel consumption based on your riding distance and bike&apos;s fuel efficiency, scheduled
          maintenance (oil changes, filters, valve adjustments), tire replacement based on mileage,
          insurance premiums, registration and road tax, and gear amortisation. Enter your specific
          numbers or use the defaults for a typical riding profile.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">Common Cost Categories</h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          <strong className="text-neutral-200">Fuel</strong> is the most visible ongoing cost,
          varying from 3–7 litres per 100km depending on engine size and riding style.{' '}
          <strong className="text-neutral-200">Maintenance</strong> includes oil changes ($30–80
          DIY, $150–300 at a dealer), brake pads ($30–60 per set), and valve adjustments ($200–600
          at service intervals). <strong className="text-neutral-200">Tires</strong> last
          5,000–15,000 miles depending on type and riding — sport tires wear fastest.{' '}
          <strong className="text-neutral-200">Insurance</strong> ranges from $200 to $2,000+
          annually depending on your age, location, and bike type.{' '}
          <strong className="text-neutral-200">Gear</strong> should be budgeted at $500–1,500 per
          year for helmet replacement (every 5 years), gloves, boots, and jacket maintenance.
        </p>

        <h3 className="mb-3 mt-8 text-lg font-semibold text-neutral-100">Why Track Your Costs?</h3>
        <p className="mb-4 text-base leading-relaxed text-neutral-300">
          Tracking costs reveals patterns you would otherwise miss — like how much more a sport bike
          costs in tire wear compared to a touring bike, or how DIY maintenance can cut your annual
          costs by 40–60%. MotoVault&apos;s garage feature automates this tracking: log every
          expense, set maintenance reminders, and see your cost-per-mile trend over time. No
          spreadsheets, no guesswork.
        </p>
      </section>

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
