import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';

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

// Typography-plugin colours routed through the Trackside tokens so the page
// follows both schemes (prose-invert hardcoded dark-only greys).
const proseTokens = {
  '--tw-prose-body': 'var(--mv-ink-2)',
  '--tw-prose-headings': 'var(--mv-ink)',
  '--tw-prose-links': 'var(--mv-copper-text)',
  '--tw-prose-bold': 'var(--mv-ink)',
  '--tw-prose-counters': 'var(--mv-ink-3)',
  '--tw-prose-bullets': 'var(--mv-ink-4)',
  '--tw-prose-hr': 'var(--mv-line)',
  '--tw-prose-quotes': 'var(--mv-ink)',
  '--tw-prose-quote-borders': 'var(--mv-line)',
  '--tw-prose-captions': 'var(--mv-ink-3)',
  '--tw-prose-code': 'var(--mv-ink)',
  '--tw-prose-pre-code': 'var(--mv-ink-2)',
  '--tw-prose-pre-bg': 'var(--mv-surface)',
  '--tw-prose-th-borders': 'var(--mv-line-step)',
  '--tw-prose-td-borders': 'var(--mv-line)',
} as React.CSSProperties;

export default async function AccountDeletionPage() {
  const t = await getTranslations('AccountDeletion');

  return (
    <article className="prose mx-auto max-w-3xl px-6 py-24" style={proseTokens}>
      <h1>{t('title')}</h1>
      <p className="text-lg text-(--mv-ink-2)">{t('subtitle')}</p>

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
          <a href="mailto:support@motovault.app" className="text-(--mv-copper-text) hover:text-(--mv-copper-hover)">
            support@motovault.app
          </a>
        </p>
      </section>
    </article>
  );
}
