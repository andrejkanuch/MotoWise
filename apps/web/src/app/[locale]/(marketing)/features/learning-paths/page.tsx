import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { FeatureScreenshot } from '@/components/marketing/feature-screenshot';
import { JsonLd } from '@/components/marketing/json-ld';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BASE_URL, getCanonicalUrl } from '@/lib/constants';
import { LearningFaq } from './faq';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesLearning');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/learning-paths'),
      languages: Object.fromEntries([
        ...routing.locales.map((l) => [l, getCanonicalUrl(l, '/features/learning-paths')]),
        ['x-default', getCanonicalUrl('en', '/features/learning-paths')],
      ]),
    },
  };
}

const COURSE_GLOW_COLORS = [
  'oklch(0.76 0.13 70 / 0.08)',
  'oklch(0.65 0.15 160 / 0.08)',
  'oklch(0.65 0.14 230 / 0.08)',
  'oklch(0.76 0.1 230 / 0.08)',
] as const;

export default async function LearningPathsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesLearning');

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl(locale),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Features',
        item: getCanonicalUrl(locale, '/features'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: t('title'),
        item: getCanonicalUrl(locale, '/features/learning-paths'),
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
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: 'PT20H',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  };

  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
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

  const courses = ['course1', 'course2', 'course3', 'course4'] as const;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={courseSchema} />
      <JsonLd data={faqSchema} />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="px-6 pt-20 md:pt-24">
        <ol className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-neutral-500">
          <li>
            <Link href="/" className="transition-colors hover:text-neutral-300">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-600"
              aria-hidden="true"
            >
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/features" className="transition-colors hover:text-neutral-300">
              Features
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-600"
              aria-hidden="true"
            >
              <title>Separator</title>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </li>
          <li>
            <Link href="/features/learning-paths" className="text-neutral-300" aria-current="page">
              {t('title')}
            </Link>
          </li>
        </ol>
      </nav>

      {/* Hero */}
      <section className="px-6 pb-16 pt-8 md:pt-12">
        <div className="reveal-on-scroll mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Learning Paths
          </p>
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl lg:text-5xl">
            {t('heroTitle')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-300 leading-relaxed">
            {t('heroSubtitle')}
          </p>
          <div className="mx-auto mt-6 h-1 w-24 rounded-full bg-signature-500" />
        </div>
      </section>

      {/* App Screenshot */}
      <FeatureScreenshot
        src="/images/features/home.png"
        alt="MotoVault home dashboard with bike health score, mileage tracking, and learning recommendations"
      />

      {/* Courses */}
      <section className="px-6 py-28">
        <div className="mx-auto max-w-5xl">
          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Curriculum
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('coursesTitle')}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course, index) => (
              <article
                key={course}
                className="card-lift reveal-on-scroll group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-8 backdrop-blur-sm transition-colors hover:border-warm-500/40"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Radial glow overlay */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${COURSE_GLOW_COLORS[index]}, transparent 70%)`,
                  }}
                />

                {/* Bottom accent on hover */}
                <div className="absolute inset-x-0 bottom-0 h-[3px] bg-transparent transition-colors duration-300 group-hover:bg-warm-500" />

                {/* Content */}
                <div className="relative z-10">
                  <h3 className="text-lg font-semibold text-neutral-50">{t(`${course}Title`)}</h3>
                  <p className="mt-3 text-neutral-300 leading-relaxed">{t(`${course}Desc`)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Quiz Preview */}
      <section className="px-6 py-24">
        <div className="reveal-on-scroll mx-auto max-w-3xl rounded-xl border border-warm-500/30 bg-gradient-to-br from-neutral-900/80 to-neutral-900/40 p-8 text-center md:p-12">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
            Test Your Knowledge
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
            {t('quizTitle')}
          </h2>
          <p className="mt-4 text-lg text-neutral-300 leading-relaxed">{t('quizDesc')}</p>
        </div>
      </section>

      {/* Long-form Content */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="reveal-on-scroll mb-16">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Under the Hood
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              {t('longFormTitle')}
            </h2>
          </div>
          <p className="reveal-on-scroll text-lg leading-relaxed text-neutral-300">
            {t('longFormIntro')}
          </p>

          {/* Decorative rule */}
          <div
            className="mx-auto my-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <h3 className="reveal-on-scroll text-xl font-semibold text-neutral-50">
            {t('longFormCurriculumTitle')}
          </h3>
          <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormCurriculum')}</p>

          {/* Decorative rule */}
          <div
            className="mx-auto my-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <h3 className="reveal-on-scroll text-xl font-semibold text-neutral-50">
            {t('longFormProgressionTitle')}
          </h3>
          <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormProgression')}</p>

          {/* Decorative rule */}
          <div
            className="mx-auto my-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <h3 className="reveal-on-scroll text-xl font-semibold text-neutral-50">
            {t('longFormLessonTitle')}
          </h3>
          <p className="mt-4 leading-relaxed text-neutral-300">{t('longFormLesson')}</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-4xl">
          {/* Decorative rule */}
          <div
            className="mx-auto mb-12 h-px w-32 bg-gradient-to-r from-transparent via-neutral-700 to-transparent"
            aria-hidden="true"
          />

          <div className="reveal-on-scroll mb-16 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-warm-400">
              Got Questions?
            </p>
            <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-neutral-50 sm:text-4xl">
              Frequently Asked Questions
            </h2>
          </div>

          <LearningFaq items={faqItems} />

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
