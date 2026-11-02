import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import '@/components/marketing/trackside-read.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('AccountDeletion');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/account-deletion'),
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
    <article className="mv-read">
      <header>
        <h1 className="mv-read-h1">{t('title')}</h1>
        <p className="mv-read-lede">{t('subtitle')}</p>
      </header>

      <div className="mv-read-body" style={{ marginTop: 40 }}>
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
            <a href="mailto:support@motovault.app">support@motovault.app</a>
          </p>
        </section>
      </div>
    </article>
  );
}
