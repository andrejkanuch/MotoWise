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
  const t = await getTranslations('FeaturesTripPlanning');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/trip-planning'),
      languages: getHreflangMap('/features/trip-planning'),
    },
  };
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

const FEATURE_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const STEP_INDEXES = [1, 2, 3, 4] as const;
const FAQ_INDEXES = [0, 1, 2, 3, 4, 5] as const;
const WALKTHROUGH_INDEXES = [1, 2, 3, 4] as const;
const VISIBILITY_LEVELS = ['Private', 'Unlisted', 'Public'] as const;

const ROUTE_PATH = 'M 60 330 Q 150 280 190 230 T 300 170 Q 360 120 420 100 T 540 50';

/** The route's typed stops: where they sit on the drawn path and which type they carry. */
const ROUTE_STOPS = [
  { x: 60, y: 330, labelKey: 'wp1Label' },
  { x: 190, y: 230, labelKey: 'wp2Label' },
  { x: 300, y: 170, labelKey: 'wp3Label' },
  { x: 420, y: 100, labelKey: 'wp4Label' },
] as const;

/**
 * The planned route on a graphite map: an ink trace with typed stops and the
 * day's figures beneath. A depiction of the app, not chrome: surface step,
 * hairline keyline, no blur, no glow, and no copper (copper is a verb; here
 * nothing is for pressing).
 */
function RouteDepiction({ t }: { t: Translator }) {
  const figures = [
    { value: t('routeDistance'), label: t('routeDistanceLabel') },
    { value: t('routeRiding'), label: t('routeRidingLabel') },
    { value: t('routeStops'), label: t('routeStopsLabel') },
  ];

  return (
    <div
      style={{
        background: 'var(--mv-surface)',
        border: '1px solid var(--mv-line)',
        borderRadius: 'var(--mv-radius-plate)',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 600 380"
        fill="none"
        style={{ display: 'block', width: '100%', height: 'auto' }}
        aria-hidden="true"
      >
        <path
          d={ROUTE_PATH}
          stroke="var(--mv-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {ROUTE_STOPS.map((stop) => (
          <g key={stop.labelKey}>
            <circle cx={stop.x} cy={stop.y} r="7" fill="var(--mv-ink)" />
            <circle cx={stop.x} cy={stop.y} r="3" fill="var(--mv-surface)" />
            <text
              x={stop.x + 16}
              y={stop.y - 10}
              fontSize="13"
              fontWeight="500"
              fill="var(--mv-ink-2)"
              fontFamily="var(--mv-font-body)"
            >
              {t(stop.labelKey)}
            </text>
          </g>
        ))}
        <circle cx="540" cy="50" r="7" fill="var(--mv-ink)" />
        <circle cx="540" cy="50" r="3" fill="var(--mv-surface)" />
      </svg>
      <div style={{ padding: '20px 24px 24px', borderTop: '1px solid var(--mv-line)' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--mv-ink-3)' }}>
          {t('routeLabel')}
        </div>
        <div
          style={{
            marginTop: '4px',
            fontSize: '17px',
            fontWeight: 600,
            color: 'var(--mv-ink)',
            letterSpacing: '-0.005em',
          }}
        >
          {t('routeName')}
        </div>
        <dl
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px 32px',
            margin: '16px 0 0',
            padding: 0,
          }}
        >
          {figures.map((figure) => (
            <div key={figure.label}>
              <dt
                style={{
                  fontSize: '13px',
                  lineHeight: '18px',
                  fontWeight: 500,
                  color: 'var(--mv-ink-3)',
                }}
              >
                {figure.label}
              </dt>
              <dd
                className="mv-figure"
                style={{ margin: 0, fontSize: '28px', lineHeight: '30px', color: 'var(--mv-ink)' }}
              >
                {figure.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export default async function TripPlanningPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesTripPlanning');

  return (
    <FeatureContentPage
      locale={locale}
      namespace="FeaturesTripPlanning"
      route="/features/trip-planning"
      screenshots={[
        {
          src: '/images/marketing/mw/trip-planning-new.png',
          alt: 'MotoVault trip planner with a new route on the map',
        },
        {
          src: '/images/marketing/mw/trip-detail-hero.png',
          alt: 'MotoVault trip detail with the Dolomites route overview',
        },
      ]}
      heroVisual={<RouteDepiction t={t} />}
      features={{
        title: t('featuresTitle'),
        items: FEATURE_INDEXES.map((i) => ({ title: t(`f${i}Title`), desc: t(`f${i}Desc`) })),
      }}
      steps={{
        title: t('howItWorksTitle'),
        items: STEP_INDEXES.map((i) => ({ title: t(`step${i}Title`), body: t(`step${i}Desc`) })),
      }}
      table={{
        title: t('visibilityTitle'),
        body: t('visibilityBody'),
        columns: [t('visibilityColLevel'), t('visibilityColWho'), t('visibilityColWhere')],
        rows: VISIBILITY_LEVELS.map((level) => [
          t(`vis${level}`),
          t(`vis${level}Who`),
          t(`vis${level}Where`),
        ]),
      }}
      longForm={{
        title: t('seoHeading'),
        intro: t('seoIntro'),
        sections: [
          { title: t('positioningTitle'), body: t('positioningBody') },
          { title: t('galleryTitle'), body: t('galleryBody') },
          {
            title: t('walkthroughTitle'),
            body: WALKTHROUGH_INDEXES.map((i) => t(`walkthroughP${i}`)),
          },
        ],
      }}
      faqItems={FAQ_INDEXES.map((i) => ({
        question: t(`faq${i}Question`),
        answer: t(`faq${i}Answer`),
      }))}
      related={['/features/ride-tracking', '/features/garage-management']}
    />
  );
}
