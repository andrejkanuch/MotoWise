import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { LearningFaq } from './faq';

export const revalidate = 3600;

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

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const PATH_NODES = [
  { title: 'Body position basics', meta: '8 MIN \u00b7 VIDEO', badge: 'Done', state: 'done' },
  { title: 'Countersteering, really', meta: '6 MIN \u00b7 DRILL', badge: 'Done', state: 'done' },
  { title: 'Entry speed management', meta: '10 MIN \u00b7 VIDEO', badge: 'Done', state: 'done' },
  {
    title: 'Vision & the late apex',
    meta: '12 MIN \u00b7 ON NOW',
    badge: 'Active',
    state: 'active',
  },
  { title: 'Trail-braking intro', meta: '9 MIN \u00b7 DRILL', badge: 'Next', state: 'default' },
] as const;

const PATH_CARDS = [
  {
    tag: 'Skill \u00b7 cornering',
    title: 'Mastering the corner.',
    body: 'Vision, body position, trail-braking. Nine lessons from a former racing coach.',
    progress: 55,
    lessons: '9 lessons \u00b7 72 min',
    status: 'In progress',
    statusColor: undefined,
  },
  {
    tag: 'Skill \u00b7 braking',
    title: 'Emergency braking, done right.',
    body: 'Threshold braking, ABS feel, swerving vs braking. Parking-lot drills included.',
    progress: 0,
    lessons: '6 lessons \u00b7 48 min',
    status: 'Not started',
    statusColor: undefined,
  },
  {
    tag: 'Wrench \u00b7 basics',
    title: 'Chain, tires & fluids.',
    body: 'The three things every rider should be able to do in their garage. With your specific bike\u2019s specs.',
    progress: 100,
    lessons: '8 lessons \u00b7 65 min',
    status: 'Completed',
    statusColor: 'var(--mv-success)',
  },
  {
    tag: 'Touring',
    title: 'Packing for a week on the road.',
    body: 'Weight balance, weatherproofing, what to bring, what to skip. From veteran long-haulers.',
    progress: 0,
    lessons: '7 lessons \u00b7 55 min',
    status: 'Not started',
    statusColor: undefined,
  },
  {
    tag: 'Skill \u00b7 rain',
    title: 'Riding in the wet.',
    body: 'Tire choice, line selection, smooth inputs. How to turn a soggy day into a great one.',
    progress: 25,
    lessons: '5 lessons \u00b7 40 min',
    status: 'In progress',
    statusColor: undefined,
  },
  {
    tag: 'Off-road',
    title: 'Your first dirt road.',
    body: 'Standing up, weighting pegs, gravel reflexes. An intro for road riders looking sideways.',
    progress: 0,
    lessons: '6 lessons \u00b7 50 min',
    status: 'Not started',
    statusColor: undefined,
  },
] as const;

const LEVELS = [
  {
    numeral: 'i',
    num: 'Level 01',
    title: 'Just licensed.',
    body: 'Body position, slow-speed control, lane positioning, mirror discipline. Build the base.',
  },
  {
    numeral: 'ii',
    num: 'Level 02',
    title: 'Confident commuter.',
    body: 'Emergency braking, rain riding, group etiquette, threshold braking drills.',
  },
  {
    numeral: 'iii',
    num: 'Level 03',
    title: 'Weekend carver.',
    body: 'Trail-braking, late apex, body position refinement, pace on unfamiliar roads.',
  },
  {
    numeral: 'iv',
    num: 'Level 04',
    title: 'Long-haul rider.',
    body: 'Multi-day touring, fatigue management, off-road basics, bike packing craft.',
  },
] as const;

export default async function LearningPathsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesLearning');

  const canonical = getCanonicalUrl(locale, '/features/learning-paths');

  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
    question: t(`faq.${i}.question`),
    answer: t(`faq.${i}.answer`),
  }));

  const graph = buildGraph(
    buildWebPage({
      url: canonical,
      name: t('title'),
      description: t('description'),
      locale,
      pageKey: '/features/learning-paths',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Features', url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features/learning-paths',
    ),
    buildFAQPage(faqItems, `${locale}/features/learning-paths/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* ════ HERO ════ */}
      <section
        className="mv-section-hero"
        style={{
          position: 'relative',
        }}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
            fontSize: 11,
            color: 'var(--mv-ink-3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 32,
          }}
        >
          <Link href="/" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
            MotoVault
          </Link>
          <span style={{ color: 'var(--mv-ink-4)' }}>/</span>
          <Link href="/features" style={{ color: 'var(--mv-ink-3)', textDecoration: 'none' }}>
            Features
          </Link>
          <span style={{ color: 'var(--mv-ink-4)' }}>/</span>
          <span style={{ color: 'var(--mv-warm-400)' }}>{t('title')}</span>
        </nav>

        <div className="mv-grid-hero">
          {/* Text column */}
          <div>
            <div className="mv-section-meta">Feature &middot; 04</div>
            <h1
              style={{
                fontSize: 'clamp(48px, 7.5vw, 112px)',
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: '-0.045em',
                margin: '24px 0 0',
              }}
            >
              <span style={{ display: 'block' }}>Ride longer.</span>
              <span style={{ display: 'block' }}>
                <em className="mv-serif">Know more.</em>
              </span>
            </h1>
            <p
              style={{
                marginTop: 32,
                color: 'var(--mv-ink-2)',
                fontSize: 18,
                lineHeight: 1.55,
                maxWidth: 520,
                letterSpacing: '-0.01em',
              }}
            >
              {t('heroSubtitle')}
            </p>
            <div style={{ marginTop: 40, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/#download" className="mv-btn mv-btn-primary">
                <span>Start learning</span>
                <ArrowIcon />
              </Link>
              <a href="#paths" className="mv-btn mv-btn-ghost">
                Browse paths
              </a>
            </div>
          </div>

          {/* Path progress visual */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 520,
                aspectRatio: '1/1.08',
                background: 'linear-gradient(145deg, oklch(0.16 0.012 55), oklch(0.1 0.008 55))',
                border: '1px solid var(--mv-line)',
                borderRadius: 24,
                padding: 32,
                overflow: 'hidden',
                boxShadow: '0 40px 80px -20px oklch(0 0 0 / 0.7)',
              }}
            >
              {/* Warm glow */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 80% 20%, oklch(0.76 0.18 60 / 0.12), transparent 60%)',
                  pointerEvents: 'none',
                }}
                aria-hidden="true"
              />

              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div>
                  <div
                    className="mv-mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--mv-warm-400)',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Path &middot; in progress
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      marginTop: 6,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Mastering the corner
                  </div>
                </div>
                <div
                  className="mv-mono"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'oklch(0.76 0.18 60 / 0.15)',
                    border: '1px solid oklch(0.76 0.18 60 / 0.3)',
                    color: 'var(--mv-warm-400)',
                    fontSize: 11,
                    letterSpacing: '0.05em',
                  }}
                >
                  5 / 9
                </div>
              </div>

              {/* Track */}
              <div
                style={{
                  position: 'relative',
                  marginTop: 32,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                  zIndex: 1,
                }}
              >
                {/* Vertical progress line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    bottom: 14,
                    left: 14,
                    width: 2,
                    background:
                      'linear-gradient(to bottom, var(--mv-warm-500) 0%, var(--mv-warm-500) 55%, var(--mv-line) 55%, var(--mv-line) 100%)',
                  }}
                  aria-hidden="true"
                />
                {PATH_NODES.map((node, i) => {
                  const isDone = node.state === 'done';
                  const isActive = node.state === 'active';
                  return (
                    <div
                      key={node.title}
                      style={{
                        display: 'flex',
                        gap: 16,
                        alignItems: 'center',
                        position: 'relative',
                        zIndex: 1,
                      }}
                    >
                      {/* Dot */}
                      <div
                        className="mv-mono"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          fontSize: 10,
                          background: isDone ? 'var(--mv-warm-500)' : 'var(--mv-bg)',
                          border: `2px solid ${isDone ? 'var(--mv-warm-500)' : isActive ? 'var(--mv-warm-400)' : 'var(--mv-line)'}`,
                          color: isDone
                            ? '#000'
                            : isActive
                              ? 'var(--mv-warm-400)'
                              : 'var(--mv-ink-3)',
                          boxShadow: isActive ? '0 0 0 4px oklch(0.76 0.18 60 / 0.18)' : 'none',
                        }}
                      >
                        {isDone ? '\u2713' : String(i + 1).padStart(2, '0')}
                      </div>
                      {/* Body */}
                      <div
                        style={{
                          flex: 1,
                          background: isActive
                            ? 'oklch(0.76 0.18 60 / 0.06)'
                            : 'oklch(1 0 0 / 0.02)',
                          border: `1px solid ${isActive ? 'oklch(0.76 0.18 60 / 0.3)' : 'var(--mv-line)'}`,
                          borderRadius: 12,
                          padding: '12px 16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 500,
                              letterSpacing: '-0.005em',
                            }}
                          >
                            {node.title}
                          </div>
                          <div
                            className="mv-mono"
                            style={{
                              fontSize: 10,
                              color: 'var(--mv-ink-3)',
                              marginTop: 3,
                              letterSpacing: '0.05em',
                            }}
                          >
                            {node.meta}
                          </div>
                        </div>
                        <div
                          className="mv-mono"
                          style={{
                            fontSize: 10,
                            padding: '4px 8px',
                            border: `1px solid ${isDone ? 'oklch(0.72 0.2 145 / 0.3)' : isActive ? 'oklch(0.76 0.18 60 / 0.4)' : 'var(--mv-line)'}`,
                            borderRadius: 999,
                            letterSpacing: '0.05em',
                            color: isDone
                              ? 'var(--mv-success)'
                              : isActive
                                ? 'var(--mv-warm-400)'
                                : 'var(--mv-ink-3)',
                          }}
                        >
                          {node.badge}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ RIDER LEVELS ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">Rider levels</div>
          <h2 className="mv-section-title">
            Four levels. <span className="mv-serif">One long ride.</span>
          </h2>
          <p className="mv-section-sub">
            MotoVault adapts to where you are &mdash; from your first license to your tenth tour.
            You don&apos;t start over; you grow with it.
          </p>
        </div>

        <div
          className="mv-grid-4"
          style={{
            marginTop: 60,
            gap: 2,
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          {LEVELS.map((level) => (
            <div
              key={level.num}
              style={{
                background: 'var(--mv-bg)',
                padding: '32px 24px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
                  fontStyle: 'italic',
                  fontSize: 22,
                  color: 'var(--mv-warm-400)',
                  background: 'oklch(0.76 0.18 60 / 0.12)',
                  border: '1px solid oklch(0.76 0.18 60 / 0.3)',
                  marginBottom: 20,
                }}
              >
                {level.numeral}
              </div>
              <div
                className="mv-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                {level.num}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  marginTop: 6,
                  lineHeight: 1.15,
                }}
              >
                {level.title}
              </div>
              <div
                style={{
                  marginTop: 14,
                  color: 'var(--mv-ink-3)',
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {level.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ FEATURED PATHS ════ */}
      <section id="paths" className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">Featured paths</div>
          <h2 className="mv-section-title">
            Short paths. <span className="mv-serif">Real improvements.</span>
          </h2>
          <p className="mv-section-sub">
            Each path is 6&ndash;12 lessons, 5&ndash;10 minutes each. Mix of video, drills to do in
            an empty lot, and in-app checkpoints.
          </p>
        </div>

        <div
          className="mv-grid-3"
          style={{
            marginTop: 60,
            gap: 20,
          }}
        >
          {PATH_CARDS.map((card) => (
            <div
              key={card.title}
              style={{
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
                borderRadius: 18,
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 280,
              }}
            >
              <div
                className="mv-mono"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 10,
                  color: 'var(--mv-warm-400)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--mv-warm-500)',
                  }}
                />
                {card.tag}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  marginTop: 20,
                  lineHeight: 1.2,
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  flex: 1,
                  marginTop: 10,
                  color: 'var(--mv-ink-3)',
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {card.body}
              </div>
              {/* Progress bar */}
              <div
                style={{
                  marginTop: 18,
                  height: 4,
                  borderRadius: 2,
                  background: 'oklch(1 0 0 / 0.04)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${card.progress}%`,
                    background: 'linear-gradient(90deg, var(--mv-warm-500), var(--mv-warm-400))',
                  }}
                />
              </div>
              <div
                className="mv-mono"
                style={{
                  marginTop: 24,
                  paddingTop: 20,
                  borderTop: '1px solid var(--mv-line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.05em',
                }}
              >
                <span>{card.lessons}</span>
                <span style={card.statusColor ? { color: card.statusColor } : undefined}>
                  {card.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ SHOWCASE — Why it works ════ */}
      <section className="mv-section-inner">
        <div className="mv-grid-2">
          <div>
            <div
              className="mv-mono"
              style={{
                fontSize: 11,
                color: 'var(--mv-warm-400)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Why it works
            </div>
            <h3
              style={{
                fontSize: 'clamp(32px, 3.8vw, 54px)',
                fontWeight: 500,
                lineHeight: 1,
                letterSpacing: '-0.035em',
                margin: '18px 0 0',
              }}
            >
              Learn on <span className="mv-serif">your schedule.</span>
            </h3>
            <p
              style={{
                marginTop: 20,
                color: 'var(--mv-ink-2)',
                fontSize: 16,
                lineHeight: 1.6,
                maxWidth: 500,
                letterSpacing: '-0.005em',
              }}
            >
              Short lessons. Practical drills you can do in an empty parking lot. Checkpoints so you
              know you actually got it, not just watched it.
            </p>
            {/* Checklist */}
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                '5\u201310 minute lessons \u2014 do one before a ride.',
                'Drills with printable checklists.',
                'Progress syncs across devices.',
                'Instructors: MSF coaches, racers, tourers.',
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    fontSize: 14,
                    color: 'var(--mv-ink-2)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'oklch(0.76 0.18 60 / 0.18)',
                      border: '1px solid var(--mv-warm-500)',
                      backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23e9a76a' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center',
                      marginTop: 2,
                    }}
                    aria-hidden="true"
                  />
                  {item}
                </div>
              ))}
            </div>
          </div>
          {/* Phone mockup */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'absolute',
                inset: '-40px -20px',
                background:
                  'radial-gradient(ellipse 50% 50% at 50% 50%, var(--mv-warm-900), transparent 70%)',
                filter: 'blur(60px)',
                opacity: 0.55,
                zIndex: 0,
              }}
              aria-hidden="true"
            />
            <div
              className="mv-phone-mockup"
              style={{
                position: 'relative',
              }}
            >
              {/* Dynamic island */}
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 110,
                  height: 28,
                  background: '#000',
                  borderRadius: 999,
                  zIndex: 3,
                }}
                aria-hidden="true"
              />
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 35,
                  overflow: 'hidden',
                  background: '#111',
                }}
              >
                <Image
                  src="/images/marketing/mw/home-dashboard.png"
                  alt="MotoVault home dashboard showing learning progress and recommendations"
                  width={640}
                  height={1386}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                  }}
                  sizes="320px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ STATS ROW ════ */}
      <section className="mv-section-stats mv-grid-stats">
        {[
          { value: '40', unit: '+', label: 'Paths in the library, growing.' },
          { value: '8', unit: 'min', label: 'Average lesson length.' },
          { value: '4', unit: ' levels', label: 'Novice \u2192 long-haul tourer.' },
          { value: '92', unit: '%', label: 'Riders report improved skill.' },
        ].map((s) => (
          <div key={s.label} style={{ borderLeft: '1px solid var(--mv-line)', paddingLeft: 24 }}>
            <div
              style={{
                fontSize: 'clamp(32px, 3.6vw, 52px)',
                fontWeight: 500,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                color: 'var(--mv-ink)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.value}
              <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                {s.unit}
              </span>
            </div>
            <div
              style={{
                marginTop: 12,
                color: 'var(--mv-ink-3)',
                fontSize: 13,
                letterSpacing: '-0.005em',
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* ════ CTA ════ */}
      <section
        className="mv-section-cta"
        style={{
          position: 'relative',
          overflow: 'hidden',
          isolation: 'isolate',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 80% at 50% 50%, oklch(0.76 0.18 60 / 0.16), transparent 70%), linear-gradient(180deg, oklch(0.09 0.008 55 / 0.7), oklch(0.09 0.008 55 / 0.95))',
            zIndex: -1,
          }}
          aria-hidden="true"
        />
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <div className="mv-section-meta" style={{ justifyContent: 'center' }}>
            Start learning
          </div>
          <h2 className="mv-section-title" style={{ textAlign: 'center' }}>
            Better{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              every ride.
            </span>
          </h2>
          <p
            style={{
              margin: '24px auto 0',
              maxWidth: 460,
              fontSize: 17,
              color: 'var(--mv-ink-2)',
              lineHeight: 1.55,
              letterSpacing: '-0.01em',
            }}
          >
            Free forever. Pick a path, do one lesson, go ride.
          </p>
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Link href="/#download" className="mv-btn mv-btn-primary">
              <span>Get the app</span>
            </Link>
            <Link href="/explore" className="mv-btn mv-btn-ghost">
              Explore rider stories &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ════ NEXT FEATURE CARDS ════ */}
      <section className="mv-section-nav">
        <div
          className="mv-grid-cards"
          style={{
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          <Link
            href="/features/trip-planning"
            style={{
              background: 'var(--mv-bg)',
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 260,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div
                className="mv-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                Feature &middot; 01
              </div>
              <div
                style={{
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginTop: 16,
                }}
              >
                Trip{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  planning.
                </span>
              </div>
            </div>
            <div
              style={{
                marginTop: 32,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                color: 'var(--mv-warm-400)',
                fontWeight: 500,
              }}
            >
              Multi-day routes.
              <ArrowIcon />
            </div>
          </Link>
          <Link
            href="/features/ai-diagnostics"
            style={{
              background: 'var(--mv-bg)',
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 260,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div>
              <div
                className="mv-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                Feature &middot; 02
              </div>
              <div
                style={{
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginTop: 16,
                }}
              >
                AI{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  diagnostics.
                </span>
              </div>
            </div>
            <div
              style={{
                marginTop: 32,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                color: 'var(--mv-warm-400)',
                fontWeight: 500,
              }}
            >
              Point. Tap. Answered.
              <ArrowIcon />
            </div>
          </Link>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="mv-section-meta">Got Questions?</div>
          <h2 className="mv-section-title">Frequently Asked Questions</h2>
          <div style={{ marginTop: 48 }}>
            <LearningFaq items={faqItems} />
          </div>
        </div>
      </section>

      {/* ════ BOTTOM CTA ════ */}
      <FeatureCta />
    </>
  );
}
