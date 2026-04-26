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

const PATH_NODE_STATES = ['done', 'done', 'done', 'active', 'default'] as const;

const PATH_CARD_META = [
  { progress: 55, statusColor: undefined },
  { progress: 0, statusColor: undefined },
  { progress: 100, statusColor: 'var(--mv-success)' },
  { progress: 0, statusColor: undefined },
  { progress: 25, statusColor: undefined },
  { progress: 0, statusColor: undefined },
] as const;

const LEVEL_NUMERALS = ['i', 'ii', 'iii', 'iv'] as const;

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
            <div className="mv-section-meta">{t('heroMeta')}</div>
            <h1
              style={{
                fontSize: 'clamp(48px, 7.5vw, 112px)',
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: '-0.045em',
                margin: '24px 0 0',
              }}
            >
              <span style={{ display: 'block' }}>{t('heroHeading1')}</span>
              <span style={{ display: 'block' }}>
                <em className="mv-serif">{t('heroHeading2')}</em>
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
                <span>{t('heroCta')}</span>
                <ArrowIcon />
              </Link>
              <a href="#paths" className="mv-btn mv-btn-ghost">
                {t('heroCtaSecondary')}
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
                    {t('pathVisualLabel')}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      marginTop: 6,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {t('pathVisualTitle')}
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
                  {t('pathVisualProgress')}
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
                {PATH_NODE_STATES.map((state, i) => {
                  const isDone = state === 'done';
                  const isActive = state === 'active';
                  const idx = i + 1;
                  const nodeTitle = t(`pathNode${idx}Title`);
                  return (
                    <div
                      key={idx}
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
                            {nodeTitle}
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
                            {t(`pathNode${idx}Meta`)}
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
                          {t(`pathNode${idx}Badge`)}
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
          <div className="mv-section-meta">{t('levelsLabel')}</div>
          <h2 className="mv-section-title">
            {t('levelsTitle')} <span className="mv-serif">{t('levelsTitleSerif')}</span>
          </h2>
          <p className="mv-section-sub">{t('levelsSubtitle')}</p>
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
          {LEVEL_NUMERALS.map((numeral, i) => {
            const idx = i + 1;
            return (
              <div
                key={idx}
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
                  {numeral}
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
                  {t(`level${idx}Num`)}
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
                  {t(`level${idx}Title`)}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    color: 'var(--mv-ink-3)',
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  {t(`level${idx}Body`)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ════ FEATURED PATHS ════ */}
      <section id="paths" className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">{t('pathsLabel')}</div>
          <h2 className="mv-section-title">
            {t('pathsTitle')} <span className="mv-serif">{t('pathsTitleSerif')}</span>
          </h2>
          <p className="mv-section-sub">{t('pathsSubtitle')}</p>
        </div>

        <div
          className="mv-grid-3"
          style={{
            marginTop: 60,
            gap: 20,
          }}
        >
          {PATH_CARD_META.map((card, i) => {
            const idx = i + 1;
            return (
              <div
                key={idx}
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
                  {t(`pathCard${idx}Tag`)}
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
                  {t(`pathCard${idx}Title`)}
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
                  {t(`pathCard${idx}Body`)}
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
                  <span>{t(`pathCard${idx}Lessons`)}</span>
                  <span style={card.statusColor ? { color: card.statusColor } : undefined}>
                    {t(`pathCard${idx}Status`)}
                  </span>
                </div>
              </div>
            );
          })}
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
              {t('showcaseLabel')}
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
              {t('showcaseTitle')} <span className="mv-serif">{t('showcaseTitleSerif')}</span>
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
              {t('showcaseBody')}
            </p>
            {/* Checklist */}
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([1, 2, 3, 4] as const).map((n) => (
                <div
                  key={n}
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
                  {t(`showcaseCheck${n}`)}
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
        {([1, 2, 3, 4] as const).map((n) => (
          <div key={n} style={{ borderLeft: '1px solid var(--mv-line)', paddingLeft: 24 }}>
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
              {t(`stat${n}Value`)}
              <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                {t(`stat${n}Unit`)}
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
              {t(`stat${n}Label`)}
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
            {t('ctaLabel')}
          </div>
          <h2 className="mv-section-title" style={{ textAlign: 'center' }}>
            {t('ctaTitle')}{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              {t('ctaTitleSerif')}
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
            {t('ctaSubtitle')}
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
              <span>{t('ctaCta')}</span>
            </Link>
            <Link href="/explore" className="mv-btn mv-btn-ghost">
              {t('ctaCtaSecondary')}
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
                {t('nextFeature1Label')}
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
                {t('nextFeature1Title')}{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {t('nextFeature1Serif')}
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
              {t('nextFeature1Sub')}
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
                {t('nextFeature2Label')}
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
                {t('nextFeature2Title')}{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  {t('nextFeature2Serif')}
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
              {t('nextFeature2Sub')}
              <ArrowIcon />
            </div>
          </Link>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="mv-section-meta">{t('faqLabel')}</div>
          <h2 className="mv-section-title">{t('faqTitle')}</h2>
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
