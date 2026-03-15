import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLd } from '@/components/marketing/json-ld';
import { BASE_URL } from '@/lib/constants';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('FeaturesLearning');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/features/learning-paths`,
      languages: {
        en: `${BASE_URL}/features/learning-paths`,
        es: `${BASE_URL}/es/features/learning-paths`,
        de: `${BASE_URL}/de/features/learning-paths`,
        fr: `${BASE_URL}/fr/features/learning-paths`,
        it: `${BASE_URL}/it/features/learning-paths`,
        'x-default': `${BASE_URL}/features/learning-paths`,
      },
    },
  };
}

export default async function LearningPathsPage() {
  const t = await getTranslations('FeaturesLearning');

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
        item: `${BASE_URL}/features/learning-paths`,
      },
    ],
  };

  const courseSchema = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: t('title'),
    description: t('description'),
    provider: {
      '@type': 'Organization',
      name: 'MotoVault',
      url: BASE_URL,
    },
  };

  const courses = ['course1', 'course2', 'course3', 'course4'] as const;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={courseSchema} />

      {/* Hero */}
      <section className="px-4 pb-16 pt-24 md:pt-32">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-50 sm:text-5xl md:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">{t('heroSubtitle')}</p>
        </div>
      </section>

      {/* Courses */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="reveal-on-scroll text-center text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('coursesTitle')}
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {courses.map((course) => (
              <div
                key={course}
                className="reveal-on-scroll rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8"
              >
                <h3 className="text-xl font-bold text-neutral-50">{t(`${course}Title`)}</h3>
                <p className="mt-3 text-neutral-400">{t(`${course}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quiz Preview */}
      <section className="px-4 py-16">
        <div className="reveal-on-scroll mx-auto max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-900/50 p-8 text-center md:p-12">
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-50">
            {t('quizTitle')}
          </h2>
          <p className="mt-4 text-lg text-neutral-400">{t('quizDesc')}</p>
        </div>
      </section>

      {/* CTA */}
      <FeatureCta />
    </>
  );
}
