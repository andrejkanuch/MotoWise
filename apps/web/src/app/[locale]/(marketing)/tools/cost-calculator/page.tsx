import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { getCanonicalUrl } from '@/lib/constants';
import { CostCalculator } from './cost-calculator';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  return {
    title: 'Motorcycle Cost of Ownership Calculator | MotoVault',
    description:
      'Calculate the true cost of owning a motorcycle. Estimate fuel, insurance, maintenance, tires, and registration costs. Find out how much a motorcycle costs to maintain per year and per mile.',
    keywords: [
      'motorcycle cost calculator',
      'how much does a motorcycle cost to maintain',
      'motorcycle cost of ownership',
      'motorcycle annual cost',
      'motorcycle cost per mile',
    ],
    alternates: {
      canonical: getCanonicalUrl(locale, '/tools/cost-calculator'),
      languages: {
        en: `${BASE_URL}/tools/cost-calculator`,
        es: `${BASE_URL}/es/tools/cost-calculator`,
        de: `${BASE_URL}/de/tools/cost-calculator`,
        fr: `${BASE_URL}/fr/tools/cost-calculator`,
        it: `${BASE_URL}/it/tools/cost-calculator`,
        'x-default': `${BASE_URL}/tools/cost-calculator`,
      },
    },
  };
}

export default function CostCalculatorPage() {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Tools',
        item: `${BASE_URL}/tools`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Motorcycle Cost Calculator',
        item: `${BASE_URL}/tools/cost-calculator`,
      },
    ],
  };

  const webAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Motorcycle Cost of Ownership Calculator',
    description:
      'Calculate the true cost of owning a motorcycle including fuel, insurance, maintenance, tires, and registration fees.',
    url: `${BASE_URL}/tools/cost-calculator`,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    provider: {
      '@type': 'Organization',
      name: 'MotoVault',
      url: BASE_URL,
    },
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={webAppSchema} />

      {/* Hero */}
      <section className="px-4 pb-8 pt-24 md:pt-32">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            Motorcycle Cost of Ownership <span className="text-warm-400">Calculator</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            Find out the true cost of owning your motorcycle. Estimate annual expenses including
            fuel, insurance, maintenance, and more &mdash; then see your cost per mile and 5-year
            projection.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <CostCalculator />

      {/* SEO Content */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-neutral-50">
            How Much Does a Motorcycle Cost to Own?
          </h2>
          <div className="mt-6 space-y-4 text-neutral-400">
            <p>
              The purchase price is only the beginning. Annual motorcycle ownership costs typically
              range from $1,500 to $5,000+ depending on your riding habits, bike type, and
              maintenance preferences. Understanding these costs helps you budget effectively and
              avoid surprises.
            </p>
            <p>
              Fuel costs vary significantly by motorcycle type. Touring bikes average around 38 MPG
              while adventure bikes can achieve 50+ MPG. Your annual mileage is the biggest factor
              in fuel expenses.
            </p>
            <p>
              Regular maintenance is essential for safety and longevity. Basic maintenance (oil
              changes, chain lube) costs around $300/year, while premium care including dealer
              servicing can exceed $1,200 annually.
            </p>
          </div>

          <h2 className="mt-12 text-2xl font-bold text-neutral-50">
            Track Your Actual Costs with MotoVault
          </h2>
          <p className="mt-4 text-neutral-400">
            This calculator provides estimates, but real costs vary. MotoVault tracks your actual
            maintenance expenses, fuel fill-ups, and service history &mdash; giving you precise
            cost-per-mile data for every bike in your garage.
          </p>
        </div>
      </section>
    </>
  );
}
