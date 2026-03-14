import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Privacy');
  return {
    title: t('title'),
    description: t('infoCollect'),
    alternates: {
      canonical: `${BASE_URL}/privacy`,
      languages: {
        en: `${BASE_URL}/privacy`,
        es: `${BASE_URL}/es/privacy`,
        de: `${BASE_URL}/de/privacy`,
        fr: `${BASE_URL}/fr/privacy`,
        it: `${BASE_URL}/it/privacy`,
        'x-default': `${BASE_URL}/privacy`,
      },
    },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations('Privacy');

  const sections = [
    { title: 'infoCollectTitle', content: 'infoCollect' },
    { title: 'howWeUseTitle', content: 'howWeUse' },
    { title: 'thirdPartyTitle', content: 'thirdParty' },
    { title: 'dataRetentionTitle', content: 'dataRetention' },
    { title: 'securityTitle', content: 'security' },
    { title: 'yourRightsTitle', content: 'yourRights' },
    { title: 'childrenPrivacyTitle', content: 'childrenPrivacy' },
    { title: 'internationalTransfersTitle', content: 'internationalTransfers' },
    { title: 'accountDeletionTitle', content: 'accountDeletion' },
    { title: 'changesTitle', content: 'changes' },
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
