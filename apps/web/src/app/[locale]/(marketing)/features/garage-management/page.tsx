import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshotPair } from '@/components/marketing/feature-screenshot';
import { FeatureShowcase } from '@/components/marketing/feature-showcase';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { GarageManagementFaq } from './faq';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/garage-management'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/features/garage-management')]),
        ['x-default', getCanonicalUrl('en', '/features/garage-management')],
      ]),
    },
  };
}

const FEATURES = [
  {
    titleKey: 'multiBikeTitle' as const,
    descKey: 'multiBikeDesc' as const,
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.76 0.13 70 / 0.08)',
    iconHover: 'icon-spin-hover',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
        <path d="M12 17H8l-1.5-5H12l2 2h4l-1.5 3" />
        <path d="M9 7h4l3 5" />
      </svg>
    ),
  },
  {
    titleKey: 'nhtsaTitle' as const,
    descKey: 'nhtsaDesc' as const,
    accentClass: 'text-primary-400',
    glowColor: 'oklch(0.65 0.14 230 / 0.08)',
    iconHover: 'icon-rev-hover',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        <circle cx="17" cy="17" r="3" />
        <path d="M17 15v2h2" />
      </svg>
    ),
  },
  {
    titleKey: 'historyTitle' as const,
    descKey: 'historyDesc' as const,
    accentClass: 'text-accent-400',
    glowColor: 'oklch(0.65 0.15 160 / 0.08)',
    iconHover: 'icon-flip-hover',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
      </svg>
    ),
  },
  {
    titleKey: 'remindersTitle' as const,
    descKey: 'remindersDesc' as const,
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.76 0.13 70 / 0.08)',
    iconHover: 'icon-rev-hover',
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        <path d="M12 2v2" />
      </svg>
    ),
  },
] as const;

export default async function GarageManagementPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesGarage');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl(locale),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Features',
        item: getCanonicalUrl(locale, '/features'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: t('title'),
        item: getCanonicalUrl(locale, '/features/garage-management'),
      },
    ],
  };

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'MotoVault',
    applicationCategory: 'UtilitiesApplication',
    applicationSubCategory: 'Motorcycle Maintenance',
    operatingSystem: ['iOS', 'Android'],
    description: t('description'),
    url: BASE_URL,
    featureList: [t('multiBikeTitle'), t('nhtsaTitle'), t('historyTitle'), t('remindersTitle')],
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={softwareAppSchema} />
      <JsonLd data={faqSchema} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="px-6 pt-20 md:pt-24">
        <ol className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="transition-colors hover:text-neutral-300">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-600"
              aria-hidden="true"
            >
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/features" className="transition-colors hover:text-neutral-300">
              Features
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-600"
              aria-hidden="true"
            >
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link
              href="/features/garage-management"
              className="text-neutral-300"
              aria-current="page"
            >
              {t('title')}
            </Link>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Garage Management
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-300 leading-relaxed">
            {t('heroSubtitle')}
          </p>
          <div className="mx-auto mt-6 h-1 w-24 rounded-full bg-signature-500" />
        </div>
      </section>

      {/* App Screenshots */}
      <FeatureScreenshotPair
        screenshots={[
          {
            src: '/images/features/garage.png',
            alt: 'MotoVault digital garage with motorcycle collection overview',
          },
          {
            src: '/images/features/bike-details.png',
            alt: 'MotoVault bike details showing BMW R 1250 GS with maintenance history',
          },
        ]}
      />

      {/* Feature Grid */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Your Digital Garage
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
              Built for Multi-Bike Riders
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <article
                key={feature.titleKey}
                className="card-lift reveal-on-scroll group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-8 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Radial glow — intensifies on hover */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${feature.glowColor}, transparent 70%)`,
                  }}
                />

                {/* Bottom accent on hover */}
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />

                {/* Content */}
                <div className="relative z-10 flex min-w-0 flex-col">
                  <div
                    className={`mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 ${feature.iconHover} ${feature.accentClass}`}
                  >
                    {feature.icon}
                  </div>
                  <h2 className="text-lg font-semibold text-neutral-50">{t(feature.titleKey)}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-300">
                    {t(feature.descKey)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Long-form Content */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          {/* Decorative rule */}
          <div
            className="mx-auto mb-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Under the Hood
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
              {t('longFormTitle')}
            </h2>
          </div>

          <p className="reveal-on-scroll text-lg leading-relaxed text-neutral-300">
            {t('longFormIntro')}
          </p>

          {/* Decorative rule between sections */}
          <div
            className="mx-auto my-12 h-px w-16 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <div className="reveal-on-scroll">
            <h3 className="text-xl font-semibold text-neutral-50">{t('longFormMultiBikeTitle')}</h3>
            <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormMultiBike')}</p>
          </div>

          {/* Decorative rule between sections */}
          <div
            className="mx-auto my-12 h-px w-16 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <div className="reveal-on-scroll">
            <h3 className="text-xl font-semibold text-neutral-50">
              {t('longFormSchedulingTitle')}
            </h3>
            <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormScheduling')}</p>
          </div>

          {/* Decorative rule between sections */}
          <div
            className="mx-auto my-12 h-px w-16 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          {/* Maintenance & Expenses Visual Showcase */}
          <div className="my-16">
            <FeatureShowcase
              items={[
                {
                  label: 'Smart Tracking',
                  title: 'Every Task, Organized',
                  description:
                    'Track active maintenance tasks with priority levels and mileage-based triggers. Never miss a service interval again.',
                  bullets: [
                    'Priority levels — High, Medium, Low',
                    'Due dates & mileage tracking',
                    'Full service history log',
                    'Mark done with one tap',
                  ],
                  screenshot: {
                    src: '/images/features/maintenance.png',
                    alt: 'MotoVault maintenance task tracker with priority levels and due dates',
                  },
                },
                {
                  label: 'Expense Tracking',
                  title: 'Know Where Every Dollar Goes',
                  description:
                    'Automatic cost breakdowns by category. See your true cost of ownership with per-kilometer and monthly averages.',
                  bullets: [
                    'Cost per kilometer calculated automatically',
                    'Category breakdown: Fuel, Maintenance, Parts, Gear',
                    'Monthly, yearly, and all-time views',
                    'Track every receipt in one place',
                  ],
                  screenshot: {
                    src: '/images/features/expenses.png',
                    alt: 'MotoVault expense insights showing cost breakdown by category',
                  },
                  stat: { value: '$0.19', label: 'Per Kilometer' },
                },
                {
                  label: 'Smart Alerts',
                  title: 'Countdown to Service',
                  description:
                    'Get notified before maintenance is due. Smart alerts track days remaining and mileage so you never get caught off guard.',
                  bullets: [
                    'Days-until-due countdown',
                    'Mileage-based triggers',
                    'Push notification reminders',
                    'Priority-based alert ordering',
                  ],
                  screenshot: {
                    src: '/images/features/alerts.png',
                    alt: 'MotoVault maintenance alerts with countdown timers and priority levels',
                  },
                },
              ]}
            />
          </div>

          <div className="reveal-on-scroll">
            <h3 className="text-xl font-semibold text-neutral-50">{t('longFormResaleTitle')}</h3>
            <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormResale')}</p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          {/* Decorative rule */}
          <div
            className="mx-auto mb-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Support
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
              Frequently Asked Questions
            </h2>
          </div>

          <GarageManagementFaq items={faqItems} />

          <p className="mt-12 text-center text-neutral-500">
            Have more questions?{' '}
            <Link href="/support" className="text-warm-400 underline underline-offset-4">
              Visit our support page
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
