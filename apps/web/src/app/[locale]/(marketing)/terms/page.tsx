import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Terms');
  return {
    title: t('title'),
    description: t('acceptance'),
    alternates: {
      languages: {
        en: `${BASE_URL}/terms`,
        es: `${BASE_URL}/es/terms`,
        de: `${BASE_URL}/de/terms`,
        'x-default': `${BASE_URL}/terms`,
      },
    },
  };
}

export default async function TermsPage() {
  const t = await getTranslations('Terms');

  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-24">
      <h1>{t('title')}</h1>
      <p className="text-neutral-400">{t('lastUpdated')}</p>

      <h2>{t('acceptanceTitle')}</h2>
      <p>{t('acceptance')}</p>

      <h2>{t('useTitle')}</h2>
      <p>{t('use')}</p>

      <h2>{t('accountsTitle')}</h2>
      <p>{t('accounts')}</p>

      <h2>{t('ipTitle')}</h2>
      <p>{t('ip')}</p>

      <h2>{t('liabilityTitle')}</h2>
      <p>{t('liability')}</p>
    </article>
  );
}
