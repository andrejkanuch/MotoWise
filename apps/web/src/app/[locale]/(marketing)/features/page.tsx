import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildGraph, buildWebPage } from '@/lib/seo/schema';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

const FEATURES = [
  {
    titleKey: 'tripPlanningTitle',
    descKey: 'tripPlanningDesc',
    href: '/features/trip-planning',
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.70 0.16 150 / 0.08)',
    // Map-pin + route
    icon: 'M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  },
  {
    titleKey: 'diagnosticsTitle',
    descKey: 'diagnosticsDesc',
    href: '/features/ai-diagnostics',
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.76 0.13 70 / 0.08)',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  {
    titleKey: 'garageTitle',
    descKey: 'garageDesc',
    href: '/features/garage-management',
    accentClass: 'text-primary-400',
    glowColor: 'oklch(0.65 0.14 230 / 0.08)',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    titleKey: 'learningTitle',
    descKey: 'learningDesc',
    href: '/features/learning-paths',
    accentClass: 'text-accent-400',
    glowColor: 'oklch(0.65 0.15 160 / 0.08)',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    titleKey: 'maintenanceTitle',
    descKey: 'maintenanceDesc',
    href: '/features/maintenance',
    accentClass: 'text-warm-400',
    glowColor: 'oklch(0.76 0.13 70 / 0.08)',
    icon: 'M14.7 6.3a4 4 0 0 0-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 0 0 5.6-5.6l-2.5 2.5-2.8-2.8 2.5-2.5z',
  },
  {
    titleKey: 'expensesTitle',
    descKey: 'expensesDesc',
    href: '/features/expense-tracking',
    accentClass: 'text-accent-400',
    glowColor: 'oklch(0.65 0.15 160 / 0.08)',
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  },
  {
    titleKey: 'ridesTitle',
    descKey: 'ridesDesc',
    href: '/features/ride-tracking',
    accentClass: 'text-primary-400',
    glowColor: 'oklch(0.65 0.14 230 / 0.08)',
    icon: 'M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  },
] as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesIndex');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features'),
      languages: getHreflangMap('/features'),
    },
  };
}

export default async function FeaturesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesIndex');

  const canonical = getCanonicalUrl(locale, '/features');

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/features',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features',
    ),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

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
            <Link href="/features" className="text-neutral-300" aria-current="page">
              {t('title')}
            </Link>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pb-24 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            {t('sectionLabel')}
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <div className="mx-auto mt-6 h-1.5 w-32 rounded-full bg-signature-500" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400 md:text-xl">
            {t('heroSubtitle')}
          </p>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="card-lift reveal-on-scroll group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-8 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Radial glow */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${feature.glowColor}, transparent 70%)`,
                  }}
                />

                {/* Bottom accent on hover */}
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />

                {/* Content */}
                <div className="relative z-10">
                  <div
                    className={`mb-4 flex size-10 items-center justify-center rounded-xl bg-neutral-800/80 ${feature.accentClass}`}
                  >
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
                      <path d={feature.icon} />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-neutral-50">{t(feature.titleKey)}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-300">
                    {t(feature.descKey)}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-warm-400 transition-colors group-hover:text-warm-300">
                    {t('learnMore')}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
