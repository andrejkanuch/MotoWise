import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Privacy');
  return {
    title: t('title'),
    description: t('infoCollect'),
    alternates: {
      languages: {
        en: `${BASE_URL}/privacy`,
        es: `${BASE_URL}/es/privacy`,
        de: `${BASE_URL}/de/privacy`,
        'x-default': `${BASE_URL}/privacy`,
      },
    },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations('Privacy');

  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-24">
      <h1>{t('title')}</h1>
      <p className="text-neutral-400">{t('lastUpdated')}</p>

      <h2>{t('infoCollectTitle')}</h2>
      <p>{t('infoCollect')}</p>

      <h2>{t('howWeUseTitle')}</h2>
      <p>{t('howWeUse')}</p>

      <h2>{t('securityTitle')}</h2>
      <p>{t('security')}</p>

      <h2>{t('rightsTitle')}</h2>
      <p>{t('rights')}</p>
    </article>
  );
}
