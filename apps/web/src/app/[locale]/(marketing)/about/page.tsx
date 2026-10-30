import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { LEGAL_ADDRESS, LEGAL_NAME } from '@/lib/seo/schema';

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

const pillars = ['aiPowered', 'communityDriven', 'openKnowledge'] as const;

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
    legalName: LEGAL_NAME,
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
    address: LEGAL_ADDRESS,
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
        legalName: LEGAL_NAME,
        url: BASE_URL,
      },
      description: t('founderBio'),
      nationality: {
        '@type': 'Country',
        name: 'Slovakia',
      },
    },
    dateCreated: '2025-01-01T00:00:00+00:00',
    dateModified: '2026-03-28T00:00:00+00:00',
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={organizationSchema} />
      <JsonLd data={profilePageSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-(--mv-ink) sm:text-5xl md:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-(--mv-ink-2)">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* Founder */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-on-scroll rounded-2xl border border-(--mv-line) bg-(--mv-surface) p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-(--mv-surface-2)">
                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative avatar placeholder */}
                <svg
                  className="h-12 w-12 text-(--mv-ink-3)"
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
                <h2 className="text-2xl font-extrabold tracking-tight text-(--mv-ink)">
                  {t('founderName')}
                </h2>
                <p className="mt-1 text-sm font-medium text-(--mv-ink-3)">{t('founderRole')}</p>
                <p className="mt-4 text-(--mv-ink-2) leading-relaxed">{t('founderBio')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="reveal-on-scroll text-3xl font-extrabold tracking-tight text-(--mv-ink)">
            {t('missionTitle')}
          </h2>
          <p className="reveal-on-scroll mx-auto mt-6 max-w-2xl text-lg text-(--mv-ink-2) leading-relaxed">
            {t('missionDescription')}
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-(--mv-ink)">
            {t('statsTitle')}
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.key} className="reveal-on-scroll text-center">
                <p className="mv-figure text-3xl text-(--mv-ink)">{stat.value}</p>
                <p className="mt-2 text-sm text-(--mv-ink-3)">{t(`stats.${stat.key}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values / Pillars */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-(--mv-ink)">
            {t('valuesTitle')}
          </h2>
          <div className="mt-12 grid gap-10 text-left sm:grid-cols-3">
            {pillars.map((pillar) => (
              <div key={pillar} className="reveal-on-scroll">
                <h3 className="text-lg font-bold text-(--mv-ink)">{t(`values.${pillar}.title`)}</h3>
                <p className="mt-2 text-sm text-(--mv-ink-2)">{t(`values.${pillar}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company Info */}
      <section className="px-4 py-16 pb-24">
        <div className="mx-auto max-w-4xl">
          <div className="reveal-on-scroll rounded-2xl border border-(--mv-line) bg-(--mv-surface) p-8 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-(--mv-ink)">
              {t('companyTitle')}
            </h2>
            <div className="mt-6 flex flex-wrap justify-center gap-8 text-sm text-(--mv-ink-3)">
              <div>
                <span className="block font-medium text-(--mv-ink-2)">{t('companyFounded')}</span>
                2025
              </div>
              <div>
                <span className="block font-medium text-(--mv-ink-2)">{t('companyLocation')}</span>
                {t('companyLocationValue')}
              </div>
              <div>
                <span className="block font-medium text-(--mv-ink-2)">{t('companyContact')}</span>
                <a
                  href="mailto:support@motovault.app"
                  className="text-(--mv-copper-text) underline underline-offset-2 hover:text-(--mv-copper-hover)"
                >
                  support@motovault.app
                </a>
              </div>
            </div>
            <p className="mt-6 text-sm text-(--mv-ink-3)">{t('operatedBy')}</p>
            <div className="mt-8">
              <Link
                href="/"
                className="text-sm text-(--mv-ink-3) underline underline-offset-2 hover:text-(--mv-ink)"
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
