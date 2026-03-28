import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('About');

  return {
    title: `${t('metaTitle')} | MotoVault`,
    description: t('metaDescription'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/about'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [
          l,
          l === 'en' ? `${BASE_URL}/about` : `${BASE_URL}/${l}/about`,
        ]),
        ['x-default', `${BASE_URL}/about`],
      ]),
    },
  };
}

const stats = [
  { key: 'riders', value: '2,400+' },
  { key: 'bikes', value: '18,000+' },
  { key: 'diagnoses', value: '8,500+' },
  { key: 'articles', value: '27+' },
] as const;

const pillars = [
  {
    key: 'aiPowered',
    icon: (
      // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon
      <svg
        className="h-8 w-8 text-warm-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
        <path d="M16 14h.01" />
        <path d="M8 14h.01" />
        <path d="M12 18v4" />
        <path d="M8 22h8" />
        <path d="M5 12H3" />
        <path d="M21 12h-2" />
      </svg>
    ),
  },
  {
    key: 'communityDriven',
    icon: (
      // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon
      <svg
        className="h-8 w-8 text-warm-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'openKnowledge',
    icon: (
      // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon
      <svg
        className="h-8 w-8 text-warm-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
  },
] as const;

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('About');

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
        name: t('metaTitle'),
        item: `${BASE_URL}/about`,
      },
    ],
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MotoVault',
    url: BASE_URL,
    logo: `${BASE_URL}/icon.png`,
    description: t('metaDescription'),
    foundingDate: '2025',
    founder: {
      '@type': 'Person',
      name: 'Andrej Kanuch',
      jobTitle: 'Founder & Developer',
      url: `${BASE_URL}/about`,
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'SK',
      addressRegion: 'European Union',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@motovault.app',
      contactType: 'customer support',
    },
    sameAs: [
      'https://apps.apple.com/us/app/motovault/id6760291360',
      'https://play.google.com/store/apps/details?id=com.motovault.app',
    ],
  };

  const profilePageSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: 'Andrej Kanuch',
      jobTitle: 'Founder & Developer',
      worksFor: {
        '@type': 'Organization',
        name: 'MotoVault',
        url: BASE_URL,
      },
      description: t('founderBio'),
      nationality: {
        '@type': 'Country',
        name: 'Slovakia',
      },
    },
    dateCreated: '2025-01-01',
    dateModified: '2026-03-28',
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd data={profilePageSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* Founder */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-neutral-800">
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative avatar placeholder */}
                <svg
                  className="h-12 w-12 text-warm-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-neutral-50">
                  {t('founderName')}
                </h2>
                <p className="mt-1 text-sm font-medium text-warm-400">{t('founderRole')}</p>
                <p className="mt-4 text-neutral-300 leading-relaxed">{t('founderBio')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="reveal-on-scroll text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('missionTitle')}
          </h2>
          <p className="reveal-on-scroll mx-auto mt-6 max-w-2xl text-lg text-neutral-300 leading-relaxed">
            {t('missionDescription')}
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('statsTitle')}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.key}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center"
              >
                <p className="text-3xl font-extrabold text-warm-400">{stat.value}</p>
                <p className="mt-2 text-sm text-neutral-400">{t(`stats.${stat.key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values / Pillars */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('valuesTitle')}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {pillars.map((pillar) => (
              <div
                key={pillar.key}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800">
                  {pillar.icon}
                </div>
                <h3 className="mt-4 text-lg font-bold text-neutral-50">
                  {t(`values.${pillar.key}.title`)}
                </h3>
                <p className="mt-2 text-sm text-neutral-400">
                  {t(`values.${pillar.key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company Info */}
      <section className="px-4 py-16 pb-24">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-neutral-50">
              {t('companyTitle')}
            </h2>
            <div className="mt-6 flex flex-wrap justify-center gap-8 text-sm text-neutral-400">
              <div>
                <span className="block font-medium text-neutral-300">{t('companyFounded')}</span>
                2025
              </div>
              <div>
                <span className="block font-medium text-neutral-300">{t('companyLocation')}</span>
                {t('companyLocationValue')}
              </div>
              <div>
                <span className="block font-medium text-neutral-300">{t('companyContact')}</span>
                <a
                  href="mailto:support@motovault.app"
                  className="text-warm-400 underline underline-offset-2 hover:text-warm-300"
                >
                  support@motovault.app
                </a>
              </div>
            </div>
            <div className="mt-8">
              <Link
                href="/"
                className="text-sm text-neutral-400 underline underline-offset-2 hover:text-neutral-300"
              >
                {t('backToHome')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
