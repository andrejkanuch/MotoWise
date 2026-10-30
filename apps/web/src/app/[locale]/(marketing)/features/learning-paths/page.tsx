import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureContentPage } from '@/components/marketing/feature-content-page';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

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
      languages: getHreflangMap('/features/learning-paths'),
    },
  };
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const COURSE_INDEXES = [1, 2, 3, 4] as const;
const FAQ_INDEXES = [0, 1, 2, 3, 4] as const;
const LONG_FORM_KEYS = ['Curriculum', 'Progression', 'Lesson'] as const;

/** The depicted module: six items, three read, the fourth up next. */
const LESSONS = [
  { index: 1, status: 'read' },
  { index: 2, status: 'read' },
  { index: 3, status: 'read' },
  { index: 4, status: 'next' },
  { index: 5, status: 'todo' },
  { index: 6, status: 'todo' },
] as const;

type LessonStatus = (typeof LESSONS)[number]['status'];

const STATUS_KEY: Record<LessonStatus, string> = {
  read: 'demoStatusRead',
  next: 'demoStatusNext',
  todo: 'demoStatusTodo',
};

/** Status ink inside the depiction only: done is go-green, the rest graphite. */
const STATUS_INK: Record<LessonStatus, string> = {
  read: 'var(--mv-go)',
  next: 'var(--mv-ink)',
  todo: 'var(--mv-ink-3)',
};

/**
 * One module as the app lists it: the module name and its progress figure,
 * then the articles in reading order with what has been read. The order is
 * the curriculum, so the rows are numbered. One surface step, hairline rows.
 */
function ModuleProgress({ t }: { t: Translator }) {
  return (
    <div
      style={{
        background: 'var(--mv-surface)',
        border: '1px solid var(--mv-line)',
        borderRadius: 'var(--mv-radius-card)',
        padding: '24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '16px',
        }}
      >
        <h3 className="mv-h3">{t('demoModule')}</h3>
        <span
          className="mv-figure"
          style={{
            fontSize: '20px',
            lineHeight: '22px',
            color: 'var(--mv-ink-2)',
            whiteSpace: 'nowrap',
          }}
        >
          {t('demoProgress')}
        </span>
      </div>
      <ol style={{ listStyle: 'none', margin: '20px 0 0', padding: 0 }}>
        {LESSONS.map(({ index, status }) => (
          <li
            key={index}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 0',
              borderTop: '1px solid var(--mv-line)',
            }}
          >
            <span
              className="mv-figure"
              aria-hidden="true"
              style={{ fontSize: '20px', lineHeight: '22px', color: 'var(--mv-ink-3)' }}
            >
              {index}
            </span>
            <span style={{ minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: '15px',
                  fontWeight: 500,
                  color: 'var(--mv-ink)',
                  letterSpacing: '-0.005em',
                }}
              >
                {t(`demoLesson${index}Title`)}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '13px',
                  lineHeight: '18px',
                  color: 'var(--mv-ink-3)',
                }}
              >
                {t(`demoLesson${index}Meta`)}
              </span>
            </span>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: STATUS_INK[status],
                whiteSpace: 'nowrap',
              }}
            >
              {t(STATUS_KEY[status])}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function LearningPathsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesLearning');

  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesLearning"
      route="/features/learning-paths"
      screenshots={[
        {
          src: '/images/marketing/mw/home-alerts-articles.png',
          alt: 'MotoVault home with articles written for the rider’s bike',
        },
        {
          src: '/images/marketing/mw/home-dashboard.png',
          alt: 'MotoVault home dashboard with learning progress',
        },
      ]}
      features={{
        title: t('coursesTitle'),
        items: COURSE_INDEXES.map((i) => ({
          title: t(`course${i}Title`),
          desc: t(`course${i}Desc`),
        })),
      }}
      demo={{
        title: t('curriculumTitle'),
        body: t('curriculumBody'),
        content: <ModuleProgress t={t} />,
      }}
      longForm={{
        title: t('longFormTitle'),
        intro: t('longFormIntro'),
        sections: LONG_FORM_KEYS.map((key) => ({
          title: t(`longForm${key}Title`),
          body: t(`longForm${key}`),
        })),
      }}
      faqItems={FAQ_INDEXES.map((i) => ({
        question: t(`faq.${i}.question`),
        answer: t(`faq.${i}.answer`),
      }))}
    />
  );
}
