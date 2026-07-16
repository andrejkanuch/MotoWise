import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getCanonicalUrl } from '@/lib/constants';
import { CtaPageType } from '@/lib/cta-taxonomy';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareMaintVsRide');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/compare/maintenance-vs-ride-apps'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/compare/maintenance-vs-ride-apps')]),
        ['x-default', getCanonicalUrl('en', '/compare/maintenance-vs-ride-apps')],
      ]),
    },
  };
}

const MAINT_ICONS = [
  // Wrench
  'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  // Bell
  'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
  // Dollar
  'M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  // Layers
  'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
];

const RIDE_ICONS = [
  // Map pin
  'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 13a3 3 0 100-6 3 3 0 000 6z',
  // Compass
  'M12 22a10 10 0 100-20 10 10 0 000 20z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  // Activity
  'M22 12h-4l-3 9L9 3l-3 9H2',
  // Users
  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 7a4 4 0 100-8 4 4 0 000 8z',
];

const WHY_BOTH_ICONS = [
  // Gauge
  'M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2',
  // Trending up
  'M23 6l-9.5 9.5-5-5L1 18',
  // Book
  'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
];

export default async function MaintVsRidePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('CompareMaintVsRide');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: getCanonicalUrl(locale) },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Compare',
        item: getCanonicalUrl(locale, '/compare'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Maintenance vs Ride Apps',
        item: getCanonicalUrl(locale, '/compare/maintenance-vs-ride-apps'),
      },
    ],
  };

  const faqItems = [0, 1, 2, 3].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
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
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/compare" className="transition-colors hover:text-neutral-300">
              Compare
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
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <span className="text-neutral-300" aria-current="page">
              Maintenance vs. Ride Apps
            </span>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('heroLabel')}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {t('heroSubtitle')}
          </p>
          <p className="mt-4 text-sm text-neutral-500">{t('updatedAt')}</p>
        </div>
      </section>

      {/* Two Columns: Maintenance vs Ride */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          {/* Maintenance Column */}
          <div className="reveal-on-scroll">
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Category 1
              </p>
              <h2 className="text-2xl font-bold text-neutral-50 sm:text-3xl">{t('maintTitle')}</h2>
              <p className="mt-2 text-neutral-400">{t('maintSubtitle')}</p>
            </div>

            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-emerald-400"
                        aria-hidden="true"
                      >
                        <path d={MAINT_ICONS[i]} />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-neutral-100">
                      {t(`maintFeatures.${i}.title`)}
                    </h3>
                  </div>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {t(`maintFeatures.${i}.description`)}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm text-neutral-500">{t('maintApps')}</p>
          </div>

          {/* Ride Column */}
          <div className="reveal-on-scroll">
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">
                Category 2
              </p>
              <h2 className="text-2xl font-bold text-neutral-50 sm:text-3xl">{t('rideTitle')}</h2>
              <p className="mt-2 text-neutral-400">{t('rideSubtitle')}</p>
            </div>

            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-5"
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary-500/10">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-primary-400"
                        aria-hidden="true"
                      >
                        <path d={RIDE_ICONS[i]} />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-neutral-100">
                      {t(`rideFeatures.${i}.title`)}
                    </h3>
                  </div>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {t(`rideFeatures.${i}.description`)}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm text-neutral-500">{t('rideApps')}</p>
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* The Gap */}
      <section className="px-6 py-16 md:py-24">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('gapTitle')}
          </h2>
          <p className="mt-2 text-neutral-400">{t('gapSubtitle')}</p>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('gapContent')}</p>

          <div
            className="my-12 h-px w-full bg-gradient-to-r from-transparent via-neutral-700/50 to-transparent"
            aria-hidden="true"
          />

          <h3 className="text-2xl font-semibold text-neutral-50">{t('bridgeTitle')}</h3>
          <p className="mt-4 text-neutral-300 leading-relaxed">{t('bridgeContent')}</p>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Why You Need Both */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              {t('whyBothTitle')}
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('whyBothSubtitle')}
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="reveal-on-scroll rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-warm-500/10">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-warm-400"
                    aria-hidden="true"
                  >
                    <path d={WHY_BOTH_ICONS[i]} />
                  </svg>
                </div>
                <h3 className="font-semibold text-neutral-50">{t(`whyBoth.${i}.title`)}</h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                  {t(`whyBoth.${i}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Verdict */}
      <section className="px-6 py-16 md:py-24">
        <div className="reveal-on-scroll mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('verdictTitle')}
          </h2>
          <p className="mt-6 text-lg text-neutral-300 leading-relaxed">{t('verdict')}</p>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* Related Pages */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-center text-xl font-bold text-neutral-50">
            Related Comparisons
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/compare"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                Best Motorcycle Apps 2026
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Full feature matrix and ranking of 10 motorcycle apps.
              </p>
            </Link>
            <Link
              href="/compare/alternatives"
              className="group rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-5 transition-colors hover:border-warm-500/40"
            >
              <p className="font-semibold text-neutral-200 transition-colors group-hover:text-warm-400">
                Motorcycle App Alternatives
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Switching from REVER, RideLog, or Calimoto? See how alternatives compare.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Decorative rule */}
      <div
        className="mx-auto h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
        aria-hidden="true"
      />

      {/* FAQ */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="reveal-on-scroll mb-12 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Got Questions?
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-6">
            {faqItems.map(({ question, answer }) => (
              <div
                key={question}
                className="rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-6"
              >
                <h3 className="font-semibold text-neutral-100">{question}</h3>
                <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <FeatureCta pageType={CtaPageType.Compare} />
    </>
  );
}
