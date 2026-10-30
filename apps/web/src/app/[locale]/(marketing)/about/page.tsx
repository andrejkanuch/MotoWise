import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { LEGAL_ADDRESS, LEGAL_NAME } from '@/lib/seo/schema';
import '@/components/marketing/trackside-read.css';

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

const pillars = ['aiPowered', 'communityDriven', 'openKnowledge'] as const;

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

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
      jobTitle: 'Founder and developer',
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
      jobTitle: 'Founder and developer',
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

      <article className="mv-read">
        <header className="mv-reveal">
          <h1 className="mv-read-h1">{t('heroTitle')}</h1>
          <p className="mv-read-lede">{t('heroSubtitle')}</p>
        </header>

        {/* What it is for: one pull line, then the sentence that earns it */}
        <section className="mv-read-section" aria-labelledby="mission-heading">
          <h2 id="mission-heading" className="mv-read-h2">
            {t('missionTitle')}
          </h2>
          <div className="mv-read-body">
            <p>{t('missionDescription')}</p>
          </div>
        </section>

        {/* Founder: one row, no card */}
        <section aria-labelledby="founder-heading" className="mv-read-author">
          <span aria-hidden="true" className="mv-read-avatar lg">
            {getInitials(t('founderName'))}
          </span>
          <div>
            <h2 id="founder-heading" className="mv-read-author-name">
              {t('founderName')}
            </h2>
            <p className="mv-read-author-role">{t('founderRole')}</p>
            <p className="mv-read-author-bio">{t('founderBio')}</p>
          </div>
        </section>

        {/* Values: title left, sentence right */}
        <section className="mv-read-section" aria-labelledby="values-heading">
          <h2 id="values-heading" className="mv-read-h2">
            {t('valuesTitle')}
          </h2>
          <dl className="mv-values">
            {pillars.map((pillar) => (
              <div key={pillar}>
                <dt>{t(`values.${pillar}.title`)}</dt>
                <dd>{t(`values.${pillar}.description`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Company: a definition list on hairlines */}
        <section className="mv-read-section" aria-labelledby="company-heading">
          <h2 id="company-heading" className="mv-read-h2">
            {t('companyTitle')}
          </h2>
          <dl className="mv-defs">
            <div>
              <dt>{t('companyFounded')}</dt>
              <dd>2025</dd>
            </div>
            <div>
              <dt>{t('companyLocation')}</dt>
              <dd>{t('companyLocationValue')}</dd>
            </div>
            <div>
              <dt>{t('companyContact')}</dt>
              <dd>
                <a href="mailto:support@motovault.app" className="mv-link">
                  support@motovault.app
                </a>
              </dd>
            </div>
          </dl>
          <p className="mv-read-note" style={{ borderTop: 0, paddingTop: 0, marginTop: 20 }}>
            {t('operatedBy')}
          </p>
          <p style={{ marginTop: 32 }}>
            <Link href="/" className="mv-quiet-link">
              {t('backToHome')}
            </Link>
          </p>
        </section>
      </article>
    </>
  );
}
