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
  const t = await getTranslations('Privacy');
  return {
    title: t('title'),
    description: t('infoCollect'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/privacy'),
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

export default async function PrivacyPage() {
  const t = await getTranslations('Privacy');

  const sections = [
    { title: 'introTitle', content: 'intro' },
    { title: 'infoCollectTitle', content: 'infoCollect' },
    { title: 'howWeUseTitle', content: 'howWeUse' },
    { title: 'legalBasisTitle', content: 'legalBasis' },
    { title: 'thirdPartyTitle', content: 'thirdParty' },
    { title: 'cookiesTitle', content: 'cookies' },
    { title: 'dataRetentionTitle', content: 'dataRetention' },
    { title: 'securityTitle', content: 'security' },
    { title: 'yourRightsTitle', content: 'yourRights' },
    { title: 'childrenPrivacyTitle', content: 'childrenPrivacy' },
    { title: 'internationalTransfersTitle', content: 'internationalTransfers' },
    { title: 'accountDeletionTitle', content: 'accountDeletion' },
    { title: 'changesTitle', content: 'changes' },
    { title: 'dataControllerTitle', content: 'dataController' },
    { title: 'contactTitle', content: 'contact' },
  ] as const;

  return (
    <article className="prose mx-auto max-w-3xl px-6 py-24" style={proseTokens}>
      <h1>{t('title')}</h1>
      <p className="text-(--mv-ink-3)">{t('lastUpdated')}</p>

      {sections.map(({ title, content }) => (
        <section key={title}>
          <h2>{t(title)}</h2>
          <p>{t(content)}</p>
        </section>
      ))}
    </article>
  );
}
