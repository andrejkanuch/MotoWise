import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeatureCta } from '@/components/marketing/feature-cta';
import { JsonLdGraph } from '@/components/marketing/json-ld-graph';
import { Link } from '@/i18n/navigation';
import { getCanonicalUrl, getHreflangMap } from '@/lib/constants';
import { buildBreadcrumbList, buildFAQPage, buildGraph, buildWebPage } from '@/lib/seo/schema';
import { DiagnosticsFaq } from './diagnostics-faq';

export const revalidate = 3600;

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
        style={{
          position: 'relative',
          padding: '180px 40px 100px',
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 1fr',
            gap: 80,
            alignItems: 'center',
          }}
        >
          {/* Text */}
          <div>
            <div className="mv-section-meta">Feature &middot; 02 &middot; Powered by AI</div>
            <h1
              style={{
                fontSize: 'clamp(48px, 7.5vw, 112px)',
                fontWeight: 500,
                lineHeight: 0.92,
                letterSpacing: '-0.045em',
                margin: '24px 0 0',
              }}
            >
              <span style={{ display: 'block' }}>Point. Tap.</span>
              <span style={{ display: 'block' }}>
                <em className="mv-serif">Answered.</em>
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
                <span>Try the scanner</span>
                <ArrowIcon />
              </Link>
              <a href="#how" className="mv-btn mv-btn-ghost">
                How it works
              </a>
            </div>
          </div>

          {/* Scanner visual */}
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 480,
                aspectRatio: '4/5',
                borderRadius: 28,
                overflow: 'hidden',
                background: 'oklch(0.1 0.008 55)',
                border: '1px solid var(--mv-line)',
                boxShadow: '0 40px 80px -20px oklch(0 0 0 / 0.6)',
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
                  filter: 'brightness(0.85) saturate(0.95)',
                }}
                aria-hidden="true"
              />
              {/* Vignette */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'radial-gradient(circle at 50% 50%, transparent 40%, oklch(0.1 0.008 55 / 0.5) 90%)',
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
                    borderColor: 'var(--mv-warm-400)',
                    borderStyle: 'solid',
                    ...b,
                  }}
                  aria-hidden="true"
                />
              ))}

              {/* HUD label */}
              <div
                className="mv-mono"
                style={{
                  position: 'absolute',
                  top: 24,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: 'oklch(0.1 0.008 55 / 0.75)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid oklch(0.76 0.18 60 / 0.4)',
                  color: 'var(--mv-warm-400)',
                  fontSize: 11,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  zIndex: 3,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--mv-warm-400)',
                    boxShadow: '0 0 8px var(--mv-warm-400)',
                  }}
                />
                Scanning &middot; drivetrain
              </div>

              {/* Target box */}
              <div
                style={{
                  position: 'absolute',
                  top: '42%',
                  left: '40%',
                  width: 90,
                  height: 90,
                  border: '1.5px dashed var(--mv-warm-400)',
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
                  background: 'oklch(0.12 0.01 55 / 0.95)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid oklch(0.76 0.18 60 / 0.3)',
                  borderRadius: 16,
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
                    className="mv-mono"
                    style={{
                      fontSize: 10,
                      color: 'var(--mv-success)',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    &#10003; Diagnosed &middot; 3.2s
                  </span>
                  <span className="mv-mono" style={{ fontSize: 10, color: 'var(--mv-ink-3)' }}>
                    98% confidence
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  Chain tension too loose
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--mv-ink-3)',
                    marginTop: 6,
                    lineHeight: 1.4,
                  }}
                >
                  Slack measures ~45mm. Adjust to 25&ndash;35mm at the rear axle pivot. Estimated 8
                  minutes with standard tools.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════ TIMELINE — How it works ════ */}
      <section
        id="how"
        style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}
      >
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">How it works</div>
          <h2 className="mv-section-title">
            From photo to fix in <span className="mv-serif">under five seconds.</span>
          </h2>
        </div>

        <div
          style={{
            marginTop: 80,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 0,
            border: '1px solid var(--mv-line)',
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Connecting line */}
          <div
            style={{
              position: 'absolute',
              top: 40,
              left: '10%',
              right: '10%',
              height: 1,
              background: 'linear-gradient(90deg, transparent, var(--mv-warm-500), transparent)',
              opacity: 0.4,
            }}
            aria-hidden="true"
          />
          {[
            {
              num: '01',
              title: 'Frame the issue.',
              body: "Open the MotoVault camera and point at a warning light, a leak, an odd noise's source, or a part you don't recognize. No special framing — the model is robust to lighting and angle.",
              kvLabel: 'Camera',
              kvValue: 'Built-in \u00b7 on-device',
            },
            {
              num: '02',
              title: 'Model analyzes.',
              body: "A vision model identifies the part, then cross-references your bike's make, model and year against known failure modes. All on-device where possible; cloud fallback for edge cases.",
              kvLabel: 'Latency',
              kvValue: '< 5 seconds avg',
            },
            {
              num: '03',
              title: 'Fix it, or log it.',
              body: "Get a diagnosis, difficulty rating, estimated time and step-by-step fix. Save to your bike's history with one tap. Or share the scan with your mechanic before you even roll in.",
              kvLabel: 'Output',
              kvValue: 'Diagnosis \u00b7 fix \u00b7 share',
            },
          ].map((step, i) => (
            <div
              key={step.num}
              style={{
                padding: 40,
                background: 'var(--mv-bg)',
                borderRight: i < 2 ? '1px solid var(--mv-line)' : 'none',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--mv-bg)',
                  border: '1px solid var(--mv-line)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                  color: 'var(--mv-warm-400)',
                  position: 'relative',
                  zIndex: 1,
                  marginBottom: 28,
                }}
                className="mv-mono"
              >
                {step.num}
              </div>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  marginTop: 10,
                  color: 'var(--mv-ink-3)',
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                {step.body}
              </div>
              <div
                className="mv-mono"
                style={{
                  marginTop: 20,
                  fontSize: 11,
                  color: 'var(--mv-ink-4)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {step.kvLabel}
                <strong
                  style={{
                    display: 'block',
                    fontFamily: "var(--font-geist, 'Geist', sans-serif)",
                    fontSize: 14,
                    color: 'var(--mv-warm-400)',
                    fontWeight: 500,
                    textTransform: 'none',
                    letterSpacing: '-0.005em',
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

      {/* ════ WHAT WE DIAGNOSE — catalog grid ════ */}
      <section style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div style={{ maxWidth: 860 }}>
          <div className="mv-section-meta">What we diagnose</div>
          <h2 className="mv-section-title">
            Eight categories.{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-ink-3)' }}>
              Covering 94%
            </span>{' '}
            of everyday rider issues.
          </h2>
          <p className="mv-section-sub">
            Trained on a curated dataset of motorcycle parts and failure modes. Continuously
            expanding — each scan improves the next.
          </p>
        </div>

        <div
          style={{
            marginTop: 60,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 14,
          }}
        >
          {[
            {
              icon: 'M12 8v4 M12 16h.01 M12 2a10 10 0 100 20 10 10 0 000-20z',
              title: 'Warning lights',
              meta: 'ABS \u00b7 ECU \u00b7 TCS \u00b7 OIL \u00b7 BATT',
            },
            {
              icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 6a6 6 0 00-4 10',
              title: 'Chain & drivetrain',
              meta: 'Tension \u00b7 wear \u00b7 alignment',
            },
            {
              icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z M12 8a4 4 0 100 8 4 4 0 000-8z',
              title: 'Tire condition',
              meta: 'Wear \u00b7 pressure \u00b7 damage',
            },
            {
              icon: 'M12 2v20 M2 12h20',
              title: 'Brakes & pads',
              meta: 'Pad thickness \u00b7 rotor wear',
            },
            {
              icon: 'M3 12h18 M12 3v18',
              title: 'Fluid leaks',
              meta: 'Oil \u00b7 coolant \u00b7 brake \u00b7 fuel',
            },
            {
              icon: 'M3 3h18v18H3z M9 3v18',
              title: 'Engine & electrical',
              meta: 'Harness \u00b7 plugs \u00b7 battery',
            },
            {
              icon: 'M12 22s8-4 8-12V4l-8-2-8 2v6c0 8 8 12 8 12z',
              title: 'Fairings & damage',
              meta: 'Crash \u00b7 wear \u00b7 repair',
            },
            {
              icon: 'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
              title: 'Part identification',
              meta: 'Unknown \u2192 OEM #',
            },
          ].map((card) => (
            <div
              key={card.title}
              style={{
                background: 'var(--mv-surface)',
                border: '1px solid var(--mv-line)',
                borderRadius: 14,
                padding: 20,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'oklch(0.76 0.18 60 / 0.15)',
                  border: '1px solid oklch(0.76 0.18 60 / 0.3)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--mv-warm-400)',
                  marginBottom: 18,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={card.icon} />
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: '-0.01em' }}>
                {card.title}
              </div>
              <div
                className="mv-mono"
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: 'var(--mv-ink-3)',
                  letterSpacing: '0.05em',
                }}
              >
                {card.meta}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ════ SHOWCASE — Health history ════ */}
      <section style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 80,
            alignItems: 'center',
          }}
        >
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
              Save every scan
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
              Your bike&apos;s <span className="mv-serif">health history.</span>
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
              Every diagnosis saves to your bike&apos;s timeline — so when the same issue appears
              six months later, you already know what you did about it last time.
            </p>
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                'Auto-tagged by part, severity and date.',
                'Share any scan directly with your mechanic.',
                'Export a full health report as PDF.',
                'Alerts when a recurring issue is getting worse.',
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
          {/* Phone */}
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
              style={{
                position: 'relative',
                width: 320,
                aspectRatio: '9/19.5',
                borderRadius: 44,
                background: '#080808',
                padding: 9,
                boxShadow: '0 0 0 1px oklch(1 0 0 / 0.09), 0 60px 120px -30px oklch(0 0 0 / 0.8)',
              }}
            >
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
                  src="/images/marketing/mw/diagnostic-result.png"
                  alt="MotoVault AI diagnostic result showing chain tension analysis"
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
      <section
        style={{
          padding: '80px 40px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 48,
          borderTop: '1px solid var(--mv-line)',
          borderBottom: '1px solid var(--mv-line)',
        }}
      >
        {[
          { value: '98', unit: '%', label: 'Accuracy on known parts.' },
          { value: '<5', unit: 's', label: 'From snap to diagnosis.' },
          { value: '12', unit: 'k+', label: 'Bike models supported.' },
          { value: '8', unit: ' categories', label: 'Covering everyday issues.' },
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
        style={{
          padding: '180px 40px',
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
            Diagnose
          </div>
          <h2 className="mv-section-title" style={{ textAlign: 'center' }}>
            Skip the{' '}
            <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
              forum thread.
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
            Free on iOS and Android. Run your first scan in under 30 seconds.
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
            <Link href="/features/trip-planning" className="mv-btn mv-btn-ghost">
              See trip planning &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ════ NEXT FEATURE CARDS ════ */}
      <section
        style={{ padding: '100px 40px 140px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
            background: 'var(--mv-line)',
            border: '1px solid var(--mv-line)',
            borderRadius: 24,
            overflow: 'hidden',
          }}
        >
          <Link
            href="/features/garage-management"
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
                Next feature &middot; 03
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
                Garage{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  management.
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
              Unlimited bikes, one vault.
              <ArrowIcon />
            </div>
          </Link>
          <Link
            href="/features/learning-paths"
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
                Or see &middot; 04
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
                Learning{' '}
                <span className="mv-serif" style={{ color: 'var(--mv-warm-400)' }}>
                  paths.
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
              Novice to expert.
              <ArrowIcon />
            </div>
          </Link>
        </div>
      </section>

      {/* ════ FAQ ════ */}
      <section style={{ padding: '120px 40px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="mv-section-meta">Got Questions?</div>
          <h2 className="mv-section-title">Frequently Asked Questions</h2>
          <div style={{ marginTop: 48 }}>
            <DiagnosticsFaq
              items={faqItems}
              supportLabel="Have more questions?"
              supportLink={
                <Link
                  href="/support"
                  style={{
                    color: 'var(--mv-warm-400)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 4,
                  }}
                >
                  Visit our support page
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
