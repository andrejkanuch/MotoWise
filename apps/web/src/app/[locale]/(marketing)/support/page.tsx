import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Support');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      canonical: `${BASE_URL}/support`,
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
      <article className="prose prose-invert mx-auto max-w-3xl px-6 py-24">
        <h1>{t('title')}</h1>
        <p className="text-lg text-neutral-300">{t('subtitle')}</p>

        <section>
          <h2>{t('contactTitle')}</h2>
          <p>{t('contactDescription')}</p>
          <ul>
            <li>
              <strong>{t('emailLabel')}:</strong>{' '}
              <a href="mailto:support@motovault.app" className="text-blue-400 hover:text-blue-300">
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
            <details key={q} className="group border-b border-neutral-800 py-4">
              <summary className="cursor-pointer text-base font-medium text-neutral-100 group-open:text-white">
                {t(q)}
              </summary>
              <p className="mt-2 text-neutral-400">{t(a)}</p>
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
