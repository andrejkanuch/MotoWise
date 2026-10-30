import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { LearningFaq } from './faq';

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
  { progress: 55, completed: false },
  { progress: 0, completed: false },
  { progress: 100, completed: true },
  { progress: 0, completed: false },
  { progress: 25, completed: false },
  { progress: 0, completed: false },
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
      <section className="mv-section-hero" style={{ position: 'relative' }}>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--mv-ink-3)',
            marginBottom: 40,
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
          <span style={{ color: 'var(--mv-ink)' }}>{t('title')}</span>
        </nav>

        <div className="mv-grid-hero">
          {/* Text column */}
          <div>
            <h1
              className="mv-display"
              style={{
                fontSize: 'clamp(48px, 7vw, 104px)',
                fontWeight: 700,
                lineHeight: 0.94,
                margin: 0,
              }}
            >
              <span style={{ display: 'block' }}>{t('heroHeading1')}</span>
              <span style={{ display: 'block' }}>{t('heroHeading2')}</span>
            </h1>
            <p
              style={{
                marginTop: 28,
                color: 'var(--mv-ink-2)',
                fontSize: 18,
                lineHeight: 1.55,
                maxWidth: 520,
                letterSpacing: '-0.01em',
              }}
            >
              {t('heroSubtitle')}
            </p>
            <div style={{ marginTop: 36, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/#download" className="mv-btn mv-btn-primary">
                <span>{t('heroCta')}</span>
                <ArrowIcon />
              </Link>
              <a href="#paths" className="mv-btn mv-btn-ghost">
                {t('heroCtaSecondary')}
              </a>
            </div>
          </div>

          {/* Path progress visual — a depicted app panel: solid surface,
              hairlines, status colour only on real progress states */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 520,
                aspectRatio: '1/1.08',
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
                borderRadius: 'var(--mv-radius-plate)',
                padding: 32,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mv-ink-3)' }}>
                    {t('pathVisualLabel')}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginTop: 6,
                      letterSpacing: '-0.01em',
                      color: 'var(--mv-ink)',
                    }}
                  >
                    {t('pathVisualTitle')}
                  </div>
                </div>
                <div
                  className="mv-figure"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'var(--mv-surface-2)',
                    border: '1px solid var(--mv-line)',
                    color: 'var(--mv-ink)',
                    fontSize: 13,
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
                      'linear-gradient(to bottom, var(--mv-go) 0%, var(--mv-go) 55%, var(--mv-line) 55%, var(--mv-line) 100%)',
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
                        className="mv-figure"
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          fontSize: 12,
                          background: isDone ? 'var(--mv-go)' : 'var(--mv-surface)',
                          border: `2px solid ${isDone ? 'var(--mv-go)' : isActive ? 'var(--mv-ink)' : 'var(--mv-line-step)'}`,
                          color: isDone
                            ? 'var(--mv-surface)'
                            : isActive
                              ? 'var(--mv-ink)'
                              : 'var(--mv-ink-3)',
                        }}
                      >
                        {isDone ? '✓' : String(i + 1).padStart(2, '0')}
                      </div>
                      {/* Body */}
                      <div
                        style={{
                          flex: 1,
                          background: isActive ? 'var(--mv-surface-3)' : 'var(--mv-surface-2)',
                          border: '1px solid var(--mv-line)',
                          borderRadius: 'var(--mv-radius-control)',
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
                              color: 'var(--mv-ink)',
                            }}
                          >
                            {nodeTitle}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--mv-ink-3)',
                              marginTop: 3,
                            }}
                          >
                            {t(`pathNode${idx}Meta`)}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            color: isDone
                              ? 'var(--mv-go)'
                              : isActive
                                ? 'var(--mv-ink)'
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
          <h2 className="mv-section-title">
            {t('levelsTitle')} <span className="mv-muted">{t('levelsTitleSerif')}</span>
          </h2>
          <p className="mv-section-sub">{t('levelsSubtitle')}</p>
        </div>

        <div className="mv-grid-4" style={{ marginTop: 56, columnGap: 48, rowGap: 32 }}>
          {([1, 2, 3, 4] as const).map((idx) => (
            <div key={idx} style={{ borderTop: '1px solid var(--mv-line)', paddingTop: 20 }}>
              <div className="mv-figure" style={{ fontSize: 16, color: 'var(--mv-ink-4)' }}>
                {t(`level${idx}Num`)}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  marginTop: 10,
                  lineHeight: 1.25,
                  color: 'var(--mv-ink)',
                }}
              >
                {t(`level${idx}Title`)}
              </div>
              <div
                style={{
                  marginTop: 12,
                  color: 'var(--mv-ink-2)',
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                {t(`level${idx}Body`)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ FEATURED PATHS ════ */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div id="paths" className="mv-section-inner">
          <div style={{ maxWidth: 860 }}>
            <h2 className="mv-section-title">
              {t('pathsTitle')} <span className="mv-muted">{t('pathsTitleSerif')}</span>
            </h2>
            <p className="mv-section-sub">{t('pathsSubtitle')}</p>
          </div>

          <div className="mv-grid-3" style={{ marginTop: 56, columnGap: 48, rowGap: 48 }}>
            {PATH_CARD_META.map((card, i) => {
              const idx = i + 1;
              return (
                <div
                  key={idx}
                  style={{
                    borderTop: '1px solid var(--mv-line)',
                    paddingTop: 20,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--mv-ink-3)' }}>
                    {t(`pathCard${idx}Tag`)}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: '-0.005em',
                      marginTop: 12,
                      lineHeight: 1.25,
                      color: 'var(--mv-ink)',
                    }}
                  >
                    {t(`pathCard${idx}Title`)}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      marginTop: 10,
                      color: 'var(--mv-ink-2)',
                      fontSize: 14,
                      lineHeight: 1.55,
                    }}
                  >
                    {t(`pathCard${idx}Body`)}
                  </div>
                  {/* Progress bar — depicted app progress */}
                  <div
                    style={{
                      marginTop: 18,
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--mv-surface-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${card.progress}%`,
                        background: 'var(--mv-go)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 13,
                      color: 'var(--mv-ink-3)',
                    }}
                  >
                    <span>{t(`pathCard${idx}Lessons`)}</span>
                    <span style={card.completed ? { color: 'var(--mv-go)' } : undefined}>
                      {t(`pathCard${idx}Status`)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ════ SHOWCASE — Why it works ════ */}
      <section className="mv-section-inner">
        <div className="mv-grid-2">
          <div>
            <h3
              className="mv-display"
              style={{
                fontSize: 'clamp(32px, 3.8vw, 54px)',
                fontWeight: 700,
                lineHeight: 1,
                margin: 0,
              }}
            >
              {t('showcaseTitle')} {t('showcaseTitleSerif')}
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
                    gap: 12,
                    alignItems: 'flex-start',
                    fontSize: 15,
                    color: 'var(--mv-ink-2)',
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--mv-ink-3)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: 3 }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t(`showcaseCheck${n}`)}
                </div>
              ))}
            </div>
          </div>
          {/* Phone mockup — the one full device frame on this page */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div className="mv-phone-mockup">
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 35,
                  overflow: 'hidden',
                  background: 'var(--mv-surface)',
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
              className="mv-figure"
              style={{
                fontSize: 'clamp(32px, 3.6vw, 52px)',
                lineHeight: 1,
                color: 'var(--mv-ink)',
              }}
            >
              {t(`stat${n}Value`)}
              <span style={{ color: 'var(--mv-ink-3)' }}>{t(`stat${n}Unit`)}</span>
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
      <section className="mv-section-cta" style={{ background: 'var(--mv-bg-2)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="mv-section-title" style={{ textAlign: 'center' }}>
            {t('ctaTitle')} {t('ctaTitleSerif')}
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

      {/* ════ NEXT FEATURES ════ */}
      <section className="mv-section-nav">
        <div className="mv-grid-cards" style={{ columnGap: 80, rowGap: 0 }}>
          {[
            {
              href: '/features/trip-planning' as const,
              title: `${t('nextFeature1Title')} ${t('nextFeature1Serif')}`,
              sub: t('nextFeature1Sub'),
            },
            {
              href: '/features/ai-diagnostics' as const,
              title: `${t('nextFeature2Title')} ${t('nextFeature2Serif')}`,
              sub: t('nextFeature2Sub'),
            },
          ].map((next) => (
            <Link
              key={next.href}
              href={next.href}
              style={{
                display: 'block',
                padding: '32px 0',
                borderTop: '1px solid var(--mv-line)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                className="mv-display"
                style={{
                  fontSize: 'clamp(28px, 3vw, 40px)',
                  fontWeight: 600,
                  lineHeight: 1,
                  color: 'var(--mv-ink)',
                }}
              >
                {next.title}
              </div>
              <div
                style={{
                  marginTop: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  color: 'var(--mv-copper-text)',
                  fontWeight: 500,
                }}
              >
                {next.sub}
                <ArrowIcon />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section className="mv-section-inner">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
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
