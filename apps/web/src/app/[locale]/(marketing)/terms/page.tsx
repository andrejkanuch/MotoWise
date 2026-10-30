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
  const t = await getTranslations('Terms');
  return {
    title: t('title'),
    description: t('acceptance'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/terms'),
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

export default async function TermsPage() {
  const t = await getTranslations('Terms');

  const sections = [
    { title: 'acceptanceTitle', content: 'acceptance' },
    { title: 'ageRequirementTitle', content: 'ageRequirement' },
    { title: 'serviceDescriptionTitle', content: 'serviceDescription' },
    { title: 'accountsTitle', content: 'accounts' },
    { title: 'subscriptionsTitle', content: 'subscriptions' },
    { title: 'euConsumerRightsTitle', content: 'euConsumerRights' },
    { title: 'appStoreTermsTitle', content: 'appStoreTerms' },
    { title: 'aiDisclaimerTitle', content: 'aiDisclaimer' },
    { title: 'safetyDisclaimerTitle', content: 'safetyDisclaimer' },
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
