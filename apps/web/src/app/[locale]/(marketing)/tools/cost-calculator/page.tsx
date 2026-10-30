import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { CostCalculator } from './cost-calculator';
import '@/components/marketing/trackside-read.css';

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

      <section className="mv-wide" style={{ paddingBottom: 0 }}>
        <header className="mv-reveal mv-tool">
          <h1 className="mv-index-h1">
            {t('heroTitle')} <span className="mv-muted">{t('heroTitleAccent')}</span>
          </h1>
          <p className="mv-index-lede">{t('heroSubtitle')}</p>
        </header>
      </section>

      <CostCalculator labels={labels} />

      <article className="mv-read" style={{ paddingTop: 96 }}>
        <div className="mv-read-body">
          <h2>What a motorcycle really costs to own</h2>
          <p>
            The true cost of owning a motorcycle goes far beyond the purchase price and monthly fuel
            bill. Insurance, regular maintenance, tires, gear replacement, registration, and
            unexpected repairs all add up over a riding season. Knowing your total cost of ownership
            helps you budget accurately, compare bike options, and see where you can save without
            compromising safety.
          </p>

          <h3>What this calculator covers</h3>
          <p>
            This calculator estimates your annual motorcycle cost of ownership across six
            categories: fuel consumption based on your riding distance and the bike&apos;s fuel
            efficiency, scheduled maintenance (oil changes, filters, valve adjustments), tire
            replacement based on mileage, insurance premiums, registration and road tax, and gear
            amortisation. Enter your own numbers or use the defaults for a typical riding profile.
          </p>

          <h3>Common cost categories</h3>
          <p>
            <strong>Fuel</strong> is the most visible ongoing cost, varying from 3–7 litres per 100
            km depending on engine size and riding style. <strong>Maintenance</strong> includes oil
            changes ($30–80 DIY, $150–300 at a dealer), brake pads ($30–60 per set), and valve
            adjustments ($200–600 at service intervals). <strong>Tires</strong> last 5,000–15,000
            miles depending on type and riding; sport tires wear fastest. <strong>Insurance</strong>{' '}
            ranges from $200 to $2,000+ a year depending on your age, location, and bike type.{' '}
            <strong>Gear</strong> should be budgeted at $500–1,500 a year for helmet replacement
            (every 5 years), gloves, boots, and jacket upkeep.
          </p>

          <h3>Why track the real numbers</h3>
          <p>
            Tracking costs reveals patterns you would otherwise miss: how much more a sport bike
            costs in tire wear than a touring bike, or how DIY maintenance can cut your annual costs
            by 40–60%. MotoVault&apos;s garage records every expense against the bike, sets
            maintenance reminders, and shows your cost per mile over time. No spreadsheets, no
            guesswork.
          </p>

          <h2>{t('seoTitle1')}</h2>
          <p>{t('seoP1')}</p>
          <p>{t('seoP2')}</p>
          <p>{t('seoP3')}</p>

          <h2>{t('seoTitle2')}</h2>
          <p>{t('seoP4')}</p>
        </div>
      </article>
    </>
  );
}
