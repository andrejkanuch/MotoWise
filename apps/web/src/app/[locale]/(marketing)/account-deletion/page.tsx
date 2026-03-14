import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('AccountDeletion');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      languages: {
        en: `${BASE_URL}/account-deletion`,
        es: `${BASE_URL}/es/account-deletion`,
        de: `${BASE_URL}/de/account-deletion`,
        fr: `${BASE_URL}/fr/account-deletion`,
        it: `${BASE_URL}/it/account-deletion`,
        'x-default': `${BASE_URL}/account-deletion`,
      },
    },
  };
}

export default async function AccountDeletionPage() {
  const t = await getTranslations('AccountDeletion');

  return (
    <article className="prose prose-invert mx-auto max-w-3xl px-6 py-24">
      <h1>{t('title')}</h1>
      <p className="text-lg text-neutral-300">{t('subtitle')}</p>

      <section>
        <h2>{t('howToDeleteTitle')}</h2>
        <p>{t('howToDeleteIntro')}</p>
        <ol>
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
          <li>{t('step4')}</li>
        </ol>
      </section>

      <section>
        <h2>{t('whatDeletedTitle')}</h2>
        <p>{t('whatDeletedDescription')}</p>
        <ul>
          <li>{t('deletedItem1')}</li>
          <li>{t('deletedItem2')}</li>
          <li>{t('deletedItem3')}</li>
          <li>{t('deletedItem4')}</li>
          <li>{t('deletedItem5')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('retentionTitle')}</h2>
        <p>{t('retentionDescription')}</p>
      </section>

      <section>
        <h2>{t('alternativeTitle')}</h2>
        <p>{t('alternativeDescription')}</p>
      </section>

      <section>
        <h2>{t('contactTitle')}</h2>
        <p>
          {t('contactDescription')}{' '}
          <a href="mailto:privacy@motovault.app" className="text-blue-400 hover:text-blue-300">
            privacy@motovault.app
          </a>
        </p>
      </section>
    </article>
  );
}
