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
  const t = await getTranslations('Support');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/support'),
      languages: {
        en: `${BASE_URL}/support`,
        es: `${BASE_URL}/es/support`,
        de: `${BASE_URL}/de/support`,
        fr: `${BASE_URL}/fr/support`,
        it: `${BASE_URL}/it/support`,
        'x-default': `${BASE_URL}/support`,
      },
    },
  };
}

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires dangerouslySetInnerHTML
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
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

export default async function SupportPage() {
  const t = await getTranslations('Support');

  const faqItems = [
    { q: 'faq1Question', a: 'faq1Answer' },
    { q: 'faq2Question', a: 'faq2Answer' },
    { q: 'faq3Question', a: 'faq3Answer' },
    { q: 'faq4Question', a: 'faq4Answer' },
    { q: 'faq5Question', a: 'faq5Answer' },
    { q: 'faq6Question', a: 'faq6Answer' },
  ] as const;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({
      '@type': 'Question',
      name: t(q),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(a),
      },
    })),
  };

  return (
    <>
      <JsonLd data={faqSchema} />
      <article className="prose mx-auto max-w-3xl px-6 py-24" style={proseTokens}>
        <h1>{t('title')}</h1>
        <p className="text-lg text-(--mv-ink-2)">{t('subtitle')}</p>

        <section>
          <h2>{t('contactTitle')}</h2>
          <p>{t('contactDescription')}</p>
          <ul>
            <li>
              <strong>{t('emailLabel')}:</strong>{' '}
              <a href="mailto:support@motovault.app" className="text-(--mv-copper-text) hover:text-(--mv-copper-hover)">
                support@motovault.app
              </a>
            </li>
            <li>
              <strong>{t('responseTimeLabel')}:</strong> {t('responseTime')}
            </li>
          </ul>
        </section>

        <section>
          <h2>{t('faqTitle')}</h2>
          {faqItems.map(({ q, a }) => (
            <details key={q} className="group border-b border-(--mv-line) py-4">
              <summary className="cursor-pointer text-base font-medium text-(--mv-ink)">
                {t(q)}
              </summary>
              <p className="mt-2 text-(--mv-ink-2)">{t(a)}</p>
            </details>
          ))}
        </section>

        <section>
          <h2>{t('bugReportTitle')}</h2>
          <p>{t('bugReportDescription')}</p>
        </section>

        <section>
          <h2>{t('featureRequestTitle')}</h2>
          <p>{t('featureRequestDescription')}</p>
        </section>
      </article>
    </>
  );
}
