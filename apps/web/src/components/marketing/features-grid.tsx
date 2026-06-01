'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type FeatureKey = 'trip' | 'diag' | 'maintenance' | 'expenses' | 'rides';

interface FeatureData {
  key: FeatureKey;
  num: string;
  title: string;
  body: string;
  kv: { label: string; value: string }[];
  screenshot: string;
  badgeLabel: string;
  chip1: { label: string; value: string };
  chip2: { label: string; value: string };
}

const KEYS: FeatureKey[] = ['trip', 'diag', 'maintenance', 'expenses', 'rides'];

export function FeaturesGrid() {
  const t = useTranslations('Features');
  const [active, setActive] = useState<FeatureKey>('trip');
  const [chipsVisible, setChipsVisible] = useState(true);

  const FEATURES: FeatureData[] = [
    {
      key: 'trip',
      num: '01',
      title: t('grid.trip.title'),
      body: t('grid.trip.body'),
      kv: [
        { label: t('grid.trip.kv1Label'), value: t('grid.trip.kv1Value') },
        { label: t('grid.trip.kv2Label'), value: t('grid.trip.kv2Value') },
      ],
      screenshot: '/images/marketing/mw/trip-detail-hero.png',
      badgeLabel: t('grid.trip.badge'),
      chip1: { label: t('grid.trip.chip1Label'), value: t('grid.trip.chip1Value') },
      chip2: { label: t('grid.trip.chip2Label'), value: t('grid.trip.chip2Value') },
    },
    {
      key: 'diag',
      num: '02',
      title: t('grid.diag.title'),
      body: t('grid.diag.body'),
      kv: [
        { label: t('grid.diag.kv1Label'), value: t('grid.diag.kv1Value') },
        { label: t('grid.diag.kv2Label'), value: t('grid.diag.kv2Value') },
      ],
      screenshot: '/images/marketing/mw/diagnostic-result.png',
      badgeLabel: t('grid.diag.badge'),
      chip1: { label: t('grid.diag.chip1Label'), value: t('grid.diag.chip1Value') },
      chip2: { label: t('grid.diag.chip2Label'), value: t('grid.diag.chip2Value') },
    },
    {
      key: 'maintenance',
      num: '03',
      title: t('grid.maintenance.title'),
      body: t('grid.maintenance.body'),
      kv: [
        { label: t('grid.maintenance.kv1Label'), value: t('grid.maintenance.kv1Value') },
        { label: t('grid.maintenance.kv2Label'), value: t('grid.maintenance.kv2Value') },
      ],
      screenshot: '/images/marketing/mw/flow-add-maintenance.png',
      badgeLabel: t('grid.maintenance.badge'),
      chip1: { label: t('grid.maintenance.chip1Label'), value: t('grid.maintenance.chip1Value') },
      chip2: { label: t('grid.maintenance.chip2Label'), value: t('grid.maintenance.chip2Value') },
    },
    {
      key: 'expenses',
      num: '04',
      title: t('grid.expenses.title'),
      body: t('grid.expenses.body'),
      kv: [
        { label: t('grid.expenses.kv1Label'), value: t('grid.expenses.kv1Value') },
        { label: t('grid.expenses.kv2Label'), value: t('grid.expenses.kv2Value') },
      ],
      screenshot: '/images/marketing/mw/home-rides-expenses.png',
      badgeLabel: t('grid.expenses.badge'),
      chip1: { label: t('grid.expenses.chip1Label'), value: t('grid.expenses.chip1Value') },
      chip2: { label: t('grid.expenses.chip2Label'), value: t('grid.expenses.chip2Value') },
    },
    {
      key: 'rides',
      num: '05',
      title: t('grid.rides.title'),
      body: t('grid.rides.body'),
      kv: [
        { label: t('grid.rides.kv1Label'), value: t('grid.rides.kv1Value') },
        { label: t('grid.rides.kv2Label'), value: t('grid.rides.kv2Value') },
      ],
      screenshot: '/images/marketing/mw/home-rides-expenses.png',
      badgeLabel: t('grid.rides.badge'),
      chip1: { label: t('grid.rides.chip1Label'), value: t('grid.rides.chip1Value') },
      chip2: { label: t('grid.rides.chip2Label'), value: t('grid.rides.chip2Value') },
    },
  ];

  const activeFeature = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  // Auto-rotate
  useEffect(() => {
    const timer = setInterval(() => {
      setActive((prev) => {
        const idx = KEYS.indexOf(prev);
        return KEYS[(idx + 1) % KEYS.length];
      });
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const handleClick = (key: FeatureKey) => {
    setChipsVisible(false);
    setActive(key);
    setTimeout(() => setChipsVisible(true), 200);
  };

  return (
    <section
      id="features"
      style={{
        padding: '120px 40px 200px',
        maxWidth: 'var(--mv-container)',
        margin: '0 auto',
      }}
    >
      {/* Section header */}
      <div style={{ maxWidth: '880px' }}>
        <div className="mv-section-meta">{t('grid.sectionMeta')}</div>
        <h2 className="mv-section-title">
          {t('grid.sectionTitleLead')}{' '}
          <span className="mv-serif mv-muted">{t('grid.sectionTitleEmphasis')}</span>
        </h2>
        <p className="mv-section-sub">{t('grid.sectionSub')}</p>
      </div>

      {/* Feature stage: left accordion + right phone */}
      <div
        style={{
          marginTop: '96px',
          display: 'grid',
          gridTemplateColumns: '1fr clamp(320px, 35vw, 420px)',
          gap: '96px',
          alignItems: 'flex-start',
        }}
        className="features-stage-grid"
      >
        {/* Left: feature rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {FEATURES.map((feature) => {
            const isActive = active === feature.key;
            return (
              <button
                key={feature.key}
                type="button"
                onClick={() => handleClick(feature.key)}
                style={{
                  padding: '28px',
                  borderRadius: 'var(--mv-radius)',
                  cursor: 'pointer',
                  background: isActive ? 'oklch(0.18 0.012 55 / 0.5)' : 'transparent',
                  border: isActive ? '1px solid var(--mv-line)' : '1px solid transparent',
                  transition: 'background .35s var(--mv-ease), border-color .35s var(--mv-ease)',
                  color: 'inherit',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr auto',
                  gap: '20px',
                  alignItems: 'start',
                  position: 'relative',
                  width: '100%',
                }}
              >
                {/* Number */}
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                    fontSize: '11px',
                    color: isActive ? 'var(--mv-warm-400)' : 'var(--mv-ink-4)',
                    paddingTop: '6px',
                    letterSpacing: '0.1em',
                    transition: 'color .3s',
                  }}
                >
                  {feature.num}
                </div>

                {/* Content */}
                <div>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      color: isActive ? 'var(--mv-ink)' : 'var(--mv-ink-2)',
                      transition: 'color .3s',
                      lineHeight: 1.2,
                    }}
                  >
                    {feature.title}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      lineHeight: 1.55,
                      color: 'var(--mv-ink-3)',
                      maxHeight: isActive ? '160px' : '0',
                      opacity: isActive ? 1 : 0,
                      overflow: 'hidden',
                      marginTop: isActive ? '12px' : '0',
                      transition: 'max-height .5s var(--mv-ease-expo), opacity .4s, margin-top .3s',
                    }}
                  >
                    {feature.body}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '20px',
                      marginTop: '14px',
                      maxHeight: isActive ? '60px' : '0',
                      opacity: isActive ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'max-height .5s var(--mv-ease-expo), opacity .4s',
                    }}
                  >
                    {feature.kv.map((item) => (
                      <div
                        key={item.label}
                        style={{
                          fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                          fontSize: '11px',
                          color: 'var(--mv-ink-3)',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.label}
                        <strong
                          style={{
                            display: 'block',
                            fontFamily: "var(--font-geist, 'Geist', sans-serif)",
                            fontSize: '15px',
                            color: 'var(--mv-ink)',
                            fontWeight: 500,
                            textTransform: 'none',
                            letterSpacing: '-0.01em',
                            marginTop: '2px',
                          }}
                        >
                          {item.value}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    color: isActive ? 'var(--mv-warm-400)' : 'var(--mv-ink-4)',
                    transition: 'transform .4s var(--mv-ease), color .3s',
                    paddingTop: '4px',
                    transform: isActive ? 'translateX(6px)' : 'none',
                  }}
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Right: sticky phone mockup */}
        <div
          style={{ position: 'sticky', top: '120px', paddingTop: '40px' }}
          className="feature-preview-wrap"
        >
          <div
            style={{
              position: 'relative',
              width: 'clamp(240px, 50vw, 360px)',
              margin: '0 auto',
              perspective: '2200px',
            }}
          >
            {/* Halo glow */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-80px -60px',
                background:
                  'radial-gradient(ellipse 55% 55% at 30% 40%, var(--mv-warm-900), transparent 70%), radial-gradient(ellipse 45% 45% at 75% 70%, oklch(0.3 0.1 260 / 0.5), transparent 70%)',
                filter: 'blur(70px)',
                opacity: 0.75,
                zIndex: 0,
              }}
            />

            {/* Grid background */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-10% -15%',
                zIndex: 0,
                backgroundImage:
                  'linear-gradient(to right, oklch(1 0 0 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.04) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
                maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, #000, transparent 80%)',
                pointerEvents: 'none',
              }}
            />

            {/* Badge */}
            <div
              style={{
                position: 'absolute',
                top: '-14px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                fontSize: '10px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--mv-ink-2)',
                background: 'oklch(0.14 0.01 55 / 0.92)',
                backdropFilter: 'blur(20px)',
                border: '1px solid var(--mv-line)',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
                boxShadow: '0 12px 24px -8px oklch(0 0 0 / 0.6)',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--mv-warm-400)',
                  boxShadow: '0 0 0 4px var(--mv-warm-900)',
                  animation: 'mv-pulse-dot 1.8s infinite ease-in-out',
                }}
              />
              {activeFeature.badgeLabel}
            </div>

            {/* Floating chip 1 */}
            <div
              style={{
                position: 'absolute',
                zIndex: 4,
                background: 'oklch(0.15 0.01 55 / 0.9)',
                backdropFilter: 'blur(18px)',
                border: '1px solid var(--mv-line)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                boxShadow: '0 20px 40px -12px oklch(0 0 0 / 0.7)',
                top: '22%',
                left: '-80px',
                opacity: chipsVisible ? 1 : 0,
                transform: chipsVisible ? 'translateY(0)' : 'translateY(16px)',
                transition: 'opacity .6s var(--mv-ease-expo), transform .6s var(--mv-ease-expo)',
                animation: 'mv-chip-float 6s ease-in-out infinite',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  background: 'oklch(0.72 0.2 145 / 0.18)',
                  color: 'var(--mv-success)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                    fontSize: '10px',
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {activeFeature.chip1.label}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--mv-ink)',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    marginTop: '2px',
                  }}
                >
                  {activeFeature.chip1.value}
                </div>
              </div>
            </div>

            {/* Floating chip 2 */}
            <div
              style={{
                position: 'absolute',
                zIndex: 4,
                background: 'oklch(0.15 0.01 55 / 0.9)',
                backdropFilter: 'blur(18px)',
                border: '1px solid var(--mv-line)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                boxShadow: '0 20px 40px -12px oklch(0 0 0 / 0.7)',
                bottom: '18%',
                right: '-60px',
                opacity: chipsVisible ? 1 : 0,
                transform: chipsVisible ? 'translateY(0)' : 'translateY(16px)',
                transition: 'opacity .6s var(--mv-ease-expo), transform .6s var(--mv-ease-expo)',
                animation: 'mv-chip-float 7s 1.5s ease-in-out infinite reverse',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  background: 'var(--mv-warm-500)',
                  color: 'var(--mv-bg)',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                  strokeLinejoin="round"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                    fontSize: '10px',
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {activeFeature.chip2.label}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    color: 'var(--mv-ink)',
                    fontWeight: 500,
                    letterSpacing: '-0.01em',
                    marginTop: '2px',
                  }}
                >
                  {activeFeature.chip2.value}
                </div>
              </div>
            </div>

            {/* Phone frame */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '9/19.5',
                borderRadius: '48px',
                background: 'linear-gradient(160deg, #1a1a1c, #0a0a0a)',
                padding: '10px',
                boxShadow:
                  '0 0 0 1px oklch(1 0 0 / 0.08), 0 0 0 8px oklch(0 0 0 / 0.35), inset 0 1px 0 oklch(1 0 0 / 0.12), 0 80px 140px -30px oklch(0 0 0 / 0.9), 0 40px 60px -20px oklch(0.2 0.08 60 / 0.4)',
                zIndex: 1,
                transform: 'rotateY(-6deg) rotateX(2deg)',
                transition: 'transform .8s var(--mv-ease-expo)',
              }}
            >
              {/* Notch */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '108px',
                  height: '28px',
                  background: '#000',
                  borderRadius: '999px',
                  zIndex: 3,
                  boxShadow: 'inset 0 0 0 1px oklch(1 0 0 / 0.05)',
                }}
              />
              {/* Side button */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  right: '-3px',
                  top: '120px',
                  bottom: '180px',
                  width: '3px',
                  background:
                    'linear-gradient(180deg, transparent, oklch(0.25 0.01 55) 10%, oklch(0.25 0.01 55) 90%, transparent)',
                  borderRadius: '2px',
                }}
              />
              {/* Screen */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '35px',
                  overflow: 'hidden',
                  background: '#111',
                  position: 'relative',
                }}
              >
                {FEATURES.map((feature) => (
                  <Image
                    key={feature.key}
                    src={feature.screenshot}
                    alt={t('grid.screenshotAlt', { feature: feature.badgeLabel })}
                    fill
                    sizes="360px"
                    style={{
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      opacity: active === feature.key ? 1 : 0,
                      transform: active === feature.key ? 'scale(1)' : 'scale(1.04)',
                      transition:
                        'opacity .7s var(--mv-ease-expo), transform .9s var(--mv-ease-expo)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 1040px) {
              .features-stage-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
              .feature-preview-wrap { position: relative !important; top: auto !important; margin: 0 auto; }
            }
          `,
        }}
      />
    </section>
  );
}
