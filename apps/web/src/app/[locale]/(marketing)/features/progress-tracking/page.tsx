import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { BASE_URL } from '@/lib/constants';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesProgress');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/features/progress-tracking`,
      languages: {
        en: `${BASE_URL}/features/progress-tracking`,
        es: `${BASE_URL}/es/features/progress-tracking`,
        de: `${BASE_URL}/de/features/progress-tracking`,
        fr: `${BASE_URL}/fr/features/progress-tracking`,
        it: `${BASE_URL}/it/features/progress-tracking`,
        'x-default': `${BASE_URL}/features/progress-tracking`,
      },
    },
  };
}

export default async function ProgressTrackingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesProgress');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: t('title'),
        item: `${BASE_URL}/features/progress-tracking`,
      },
    ],
  };

  const faqItems = [0, 1, 2, 3].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };

  const features = [
    { titleKey: 'badgesTitle', descKey: 'badgesDesc' },
    { titleKey: 'streaksTitle', descKey: 'streaksDesc' },
    { titleKey: 'scoresTitle', descKey: 'scoresDesc' },
  ] as const;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-3">
            {features.map(({ titleKey, descKey }) => (
              <div
                key={titleKey}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8"
              >
                <h2 className="text-xl font-bold text-neutral-50">{t(titleKey)}</h2>
                <p className="mt-3 text-neutral-400">{t(descKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Long-form Content */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="reveal-on-scroll text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('longFormTitle')}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-400">{t('longFormIntro')}</p>

          <h3 className="mt-12 text-2xl font-bold text-neutral-50">
            {t('longFormDashboardTitle')}
          </h3>
          <p className="mt-4 leading-relaxed text-neutral-400">{t('longFormDashboard')}</p>

          <h3 className="mt-12 text-2xl font-bold text-neutral-50">
            {t('longFormRemindersTitle')}
          </h3>
          <p className="mt-4 leading-relaxed text-neutral-400">{t('longFormReminders')}</p>

          <h3 className="mt-12 text-2xl font-bold text-neutral-50">
            {t('longFormAnalyticsTitle')}
          </h3>
          <p className="mt-4 leading-relaxed text-neutral-400">{t('longFormAnalytics')}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            Frequently Asked Questions
          </h2>
          <div className="mt-12 space-y-8">
            {faqItems.map(({ question, answer }) => (
              <div key={question} className="reveal-on-scroll">
                <h3 className="text-lg font-bold text-neutral-50">{question}</h3>
                <p className="mt-2 leading-relaxed text-neutral-400">{answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-neutral-500">
            Have more questions?{' '}
            <Link href="/support" className="text-warm-400 underline underline-offset-4">
              Visit our support page
            </Link>
          </p>
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
