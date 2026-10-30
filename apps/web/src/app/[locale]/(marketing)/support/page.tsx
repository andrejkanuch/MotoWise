import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/marketing/json-ld';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import '@/components/marketing/trackside-read.css';

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
      <article className="mv-read">
        <header>
          <h1 className="mv-read-h1">{t('title')}</h1>
          <p className="mv-read-lede">{t('subtitle')}</p>
        </header>

        <section className="mv-read-section" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="mv-read-h2">
            {t('contactTitle')}
          </h2>
          <div className="mv-read-body">
            <p>{t('contactDescription')}</p>
            <p>{t('bugsAndIdeas')}</p>
          </div>
          <dl className="mv-defs">
            <div>
              <dt>{t('emailLabel')}</dt>
              <dd>
                <a href="mailto:support@motovault.app" className="mv-link">
                  support@motovault.app
                </a>
              </dd>
            </div>
            <div>
              <dt>{t('responseTimeLabel')}</dt>
              <dd>{t('responseTime')}</dd>
            </div>
          </dl>
        </section>

        <section className="mv-read-section" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="mv-read-h2">
            {t('faqTitle')}
          </h2>
          <div className="mv-read-faq">
            {faqItems.map(({ q, a }) => (
              <details key={q} className="mv-disclosure is-plus">
                <summary>
                  {t(q)}
                  <svg
                    className="mv-disclosure-mark"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </summary>
                <p className="mv-read-faq-answer">{t(a)}</p>
              </details>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}
