import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Terms');
  return {
    title: t('title'),
    description: t('acceptance'),
    alternates: {
      canonical: `${BASE_URL}/terms`,
      languages: {
        en: `${BASE_URL}/terms`,
        es: `${BASE_URL}/es/terms`,
        de: `${BASE_URL}/de/terms`,
        fr: `${BASE_URL}/fr/terms`,
        it: `${BASE_URL}/it/terms`,
        'x-default': `${BASE_URL}/terms`,
      },
    },
  };
}

export default async function TermsPage() {
  const t = await getTranslations('Terms');

  const sections = [
    { title: 'acceptanceTitle', content: 'acceptance' },
    { title: 'serviceDescriptionTitle', content: 'serviceDescription' },
    { title: 'accountsTitle', content: 'accounts' },
    { title: 'subscriptionsTitle', content: 'subscriptions' },
    { title: 'aiDisclaimerTitle', content: 'aiDisclaimer' },
    { title: 'ipTitle', content: 'ip' },
    { title: 'userContentTitle', content: 'userContent' },
    { title: 'prohibitedUsesTitle', content: 'prohibitedUses' },
    { title: 'terminationTitle', content: 'termination' },
    { title: 'liabilityTitle', content: 'liability' },
    { title: 'indemnificationTitle', content: 'indemnification' },
    { title: 'governingLawTitle', content: 'governingLaw' },
    { title: 'disputeResolutionTitle', content: 'disputeResolution' },
    { title: 'modificationsTitle', content: 'modifications' },
    { title: 'contactTitle', content: 'contact' },
  ] as const;

  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-24">
      <h1>{t('title')}</h1>
      <p className="text-neutral-400">{t('lastUpdated')}</p>

      {sections.map(({ title, content }) => (
        <section key={title}>
          <h2>{t(title)}</h2>
          <p>{t(content)}</p>
        </section>
      ))}
    </article>
  );
}
