import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { DiagnosticsFaq } from './diagnostics-faq';

export const revalidate = 604800; // 7 days — repo-sourced, rebuilds on deploy

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesDiagnostics');
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: getCanonicalUrl(locale, '/features/ai-diagnostics'),
      languages: getHreflangMap('/features/ai-diagnostics'),
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

export default async function AiDiagnosticsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('FeaturesDiagnostics');

  const canonical = getCanonicalUrl(locale, '/features/ai-diagnostics');

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
      pageKey: '/features/ai-diagnostics',
    }),
    buildBreadcrumbList(
      [
        { name: 'Home', url: getCanonicalUrl(locale) },
        { name: 'Features', url: getCanonicalUrl(locale, '/features') },
        { name: t('title'), url: canonical },
      ],
      locale,
      '/features/ai-diagnostics',
    ),
    buildFAQPage(faqItems, `${locale}/features/ai-diagnostics/faq`),
  );

  return (
    <>
      <JsonLdGraph nodes={graph} />

      {/* ════ HERO ════ */}
      <section
        className="mv-section-hero"
        style={{
          position: 'relative',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
        }}
      >
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
          {/* Text */}
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
              <a href="#how" className="mv-btn mv-btn-ghost">
                {t('heroCtaSecondary')}
              </a>
            </div>
          </div>

          {/* Scanner visual — a depiction of the app: solid surface panels,
              hairlines, status colour only on the real app status */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 480,
                aspectRatio: '4/5',
                borderRadius: 'var(--mv-radius-plate)',
                overflow: 'hidden',
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
              }}
            >
              {/* Background image */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'url(/images/marketing/mw/diagnose-hub.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                aria-hidden="true"
              />

              {/* Scanner brackets */}
              {[
                { top: 24, left: 24, borderWidth: '2px 0 0 2px', borderRadius: '6px 0 0 0' },
                { top: 24, right: 24, borderWidth: '2px 2px 0 0', borderRadius: '0 6px 0 0' },
                { bottom: 24, left: 24, borderWidth: '0 0 2px 2px', borderRadius: '0 0 0 6px' },
                { bottom: 24, right: 24, borderWidth: '0 2px 2px 0', borderRadius: '0 0 6px 0' },
              ].map((b) => (
                <span
                  key={`corner-${b.borderRadius}`}
                  style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                    borderColor: 'var(--mv-plate-bone)',
                    borderStyle: 'solid',
                    ...b,
                  }}
                  aria-hidden="true"
                />
              ))}

              {/* HUD label */}
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'var(--mv-surface-2)',
                  border: '1px solid var(--mv-line)',
                  color: 'var(--mv-ink-2)',
                  fontSize: 12,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  zIndex: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('scanHud')}
              </div>

              {/* Target box */}
              <div
                style={{
                  position: 'absolute',
                  top: '42%',
                  left: '40%',
                  width: 90,
                  height: 90,
                  border: '1.5px dashed var(--mv-plate-bone)',
                  borderRadius: 8,
                  zIndex: 2,
                }}
                aria-hidden="true"
              />

              {/* Result card */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 28,
                  left: 28,
                  right: 28,
                  background: 'var(--mv-surface-2)',
                  border: '1px solid var(--mv-line)',
                  borderRadius: 'var(--mv-radius-card)',
                  padding: 16,
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--mv-go)',
                    }}
                  >
                    &#10003; {t('scanLabel')}
                  </span>
                  <span className="mv-figure" style={{ fontSize: 12, color: 'var(--mv-ink-3)' }}>
                    {t('scanConfidence')}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: 'var(--mv-ink)',
                  }}
                >
                  {t('scanTitle')}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--mv-ink-3)',
                    marginTop: 6,
                    lineHeight: 1.4,
                  }}
                >
                  {t('scanBody')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ TIMELINE — How it works ════ */}
      <section id="how" className="mv-section-inner">
        <div style={{ maxWidth: 860 }}>
          <h2 className="mv-section-title">
            {t('howTitle')} <span className="mv-muted">{t('howTitleSerif')}</span>
          </h2>
        </div>

        <div className="mv-grid-3" style={{ marginTop: 72, gap: 48, alignItems: 'start' }}>
          {[
            {
              num: '01',
              title: t('step1Title2'),
              body: t('step1Body'),
              kvLabel: t('step1KvLabel'),
              kvValue: t('step1KvValue'),
            },
            {
              num: '02',
              title: t('step2Title2'),
              body: t('step2Body'),
              kvLabel: t('step2KvLabel'),
              kvValue: t('step2KvValue'),
            },
            {
              num: '03',
              title: t('step3Title2'),
              body: t('step3Body'),
              kvLabel: t('step3KvLabel'),
              kvValue: t('step3KvValue'),
            },
          ].map((step) => (
            <div key={step.num}>
              <div
                className="mv-figure"
                style={{ fontSize: 18, color: 'var(--mv-ink-4)', marginBottom: 20 }}
              >
                {step.num}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: '-0.005em',
                  lineHeight: 1.25,
                  color: 'var(--mv-ink)',
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  marginTop: 10,
                  color: 'var(--mv-ink-2)',
                  fontSize: 15,
                  lineHeight: 1.6,
                }}
              >
                {step.body}
              </div>
              <div
                style={{
                  marginTop: 20,
                  fontSize: 13,
                  color: 'var(--mv-ink-3)',
                }}
              >
                {step.kvLabel}
                <strong
                  className="mv-figure"
                  style={{
                    display: 'block',
                    fontSize: 18,
                    color: 'var(--mv-ink)',
                    marginTop: 2,
                  }}
                >
                  {step.kvValue}
                </strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ WHAT WE DIAGNOSE — catalog list ════ */}
      <section style={{ background: 'var(--mv-bg-2)' }}>
        <div className="mv-section-inner">
          <div style={{ maxWidth: 860 }}>
            <h2 className="mv-section-title">
              {t('diagTitle')} <span className="mv-muted">{t('diagTitleSerif')}</span>{' '}
              {t('diagTitleEnd')}
            </h2>
            <p className="mv-section-sub">{t('diagSubtitle')}</p>
          </div>

          <div className="mv-grid-4" style={{ marginTop: 56, columnGap: 48, rowGap: 0 }}>
            {[
              { title: t('cat1Title'), meta: t('cat1Meta') },
              { title: t('cat2Title'), meta: t('cat2Meta') },
              { title: t('cat3Title'), meta: t('cat3Meta') },
              { title: t('cat4Title'), meta: t('cat4Meta') },
              { title: t('cat5Title'), meta: t('cat5Meta') },
              { title: t('cat6Title'), meta: t('cat6Meta') },
              { title: t('cat7Title'), meta: t('cat7Meta') },
              { title: t('cat8Title'), meta: t('cat8Meta') },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  borderTop: '1px solid var(--mv-line)',
                  padding: '20px 0',
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: '-0.005em',
                    color: 'var(--mv-ink)',
                  }}
                >
                  {item.title}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: 'var(--mv-ink-3)',
                  }}
                >
                  {item.meta}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SHOWCASE — Health history ════ */}
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
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                t('showcaseCheck1'),
                t('showcaseCheck2'),
                t('showcaseCheck3'),
                t('showcaseCheck4'),
              ].map((item) => (
                <div
                  key={item}
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
                  {item}
                </div>
              ))}
            </div>
          </div>
          {/* Phone — the one full device frame on this page */}
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
                  src="/images/marketing/mw/diagnostic-result.png"
                  alt={t('showcaseAlt')}
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
          { value: t('stat1Value'), unit: t('stat1Unit'), label: t('stat1Label') },
          { value: t('stat2Value'), unit: t('stat2Unit'), label: t('stat2Label') },
          { value: t('stat3Value'), unit: t('stat3Unit'), label: t('stat3Label') },
          { value: t('stat4Value'), unit: t('stat4Unit'), label: t('stat4Label') },
        ].map((s) => (
          <div key={s.label} style={{ borderLeft: '1px solid var(--mv-line)', paddingLeft: 24 }}>
            <div
              className="mv-figure"
              style={{
                fontSize: 'clamp(32px, 3.6vw, 52px)',
                lineHeight: 1,
                color: 'var(--mv-ink)',
              }}
            >
              {s.value}
              <span style={{ color: 'var(--mv-ink-3)' }}>{s.unit}</span>
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
            <Link href="/features/trip-planning" className="mv-btn mv-btn-ghost">
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
              href: '/features/garage-management' as const,
              title: `${t('nextFeature1Title')} ${t('nextFeature1Serif')}`,
              sub: t('nextFeature1Sub'),
            },
            {
              href: '/features/learning-paths' as const,
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
            <DiagnosticsFaq
              items={faqItems}
              supportLabel={t('faqSupportLabel')}
              supportLink={
                <Link
                  href="/support"
                  style={{
                    color: 'var(--mv-copper-text)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 4,
                  }}
                >
                  {t('faqSupportLink')}
                </Link>
              }
            />
          </div>
        </div>
      </section>

      <FeatureCta />
    </>
  );
}
