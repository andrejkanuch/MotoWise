'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from './motion';

type FeatureKey = 'expenses' | 'maintenance' | 'rides' | 'trip';

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

/** Ordered by validated demand (PostHog): expenses → maintenance → rides → trips.
 *  AI diagnostics lives in its own DiagnosticsDemo section below. */
const KEYS: FeatureKey[] = ['expenses', 'maintenance', 'rides', 'trip'];

const SCREENSHOTS: Record<FeatureKey, string> = {
  expenses: '/images/marketing/mw/flow-add-expense.png',
  maintenance: '/images/marketing/mw/flow-add-maintenance.png',
  rides: '/images/marketing/mw/home-rides-expenses.png',
  trip: '/images/marketing/mw/trip-detail-hero.png',
};

export function FeaturesGrid() {
  const t = useTranslations('Features');
  const [active, setActive] = useState<FeatureKey>('expenses');
  const [chipsVisible, setChipsVisible] = useState(true);
  const panelsRef = useRef<HTMLDivElement>(null);

  const FEATURES: FeatureData[] = KEYS.map((key, i) => ({
    key,
    num: `0${i + 1}`,
    title: t(`grid.${key}.title`),
    body: t(`grid.${key}.body`),
    kv: [
      { label: t(`grid.${key}.kv1Label`), value: t(`grid.${key}.kv1Value`) },
      { label: t(`grid.${key}.kv2Label`), value: t(`grid.${key}.kv2Value`) },
    ],
    screenshot: SCREENSHOTS[key],
    badgeLabel: t(`grid.${key}.badge`),
    chip1: { label: t(`grid.${key}.chip1Label`), value: t(`grid.${key}.chip1Value`) },
    chip2: { label: t(`grid.${key}.chip2Label`), value: t(`grid.${key}.chip2Value`) },
  }));

  const activeFeature = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  // Re-pop the floating chips whenever the active feature changes.
  const isFirstRender = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `active` is the trigger — the effect reacts to the active feature changing, it does not read it.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setChipsVisible(false);
    const timer = setTimeout(() => setChipsVisible(true), 200);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const panels = panelsRef.current;
    if (!panels) return;

    const mm = gsap.matchMedia();

    // Scroll-driven activation: as each panel crosses the viewport center,
    // it becomes the active feature and the pinned phone crossfades.
    mm.add('(min-width: 1041px)', () => {
      const triggers = Array.from(panels.querySelectorAll<HTMLElement>('[data-feature-panel]')).map(
        (panel) =>
          ScrollTrigger.create({
            trigger: panel,
            start: 'top 55%',
            end: 'bottom 55%',
            onToggle: (self) => {
              if (self.isActive) setActive(panel.dataset.featurePanel as FeatureKey);
            },
          }),
      );
      return () => {
        for (const st of triggers) st.kill();
      };
    });

    // Entrance rise for each panel (skipped for reduced motion).
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tweens = Array.from(panels.querySelectorAll<HTMLElement>('[data-feature-panel]')).map(
        (panel) =>
          gsap.from(panel, {
            y: 48,
            autoAlpha: 0,
            duration: 1,
            ease: 'expo.out',
            scrollTrigger: { trigger: panel, start: 'top 82%', once: true },
          }),
      );
      return () => {
        for (const tw of tweens) tw.kill();
      };
    });

    return () => mm.revert();
  }, []);

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

      {/* Feature stage: scrolling panels + sticky phone */}
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
        {/* Left: feature panels */}
        <div ref={panelsRef} style={{ display: 'flex', flexDirection: 'column' }}>
          {FEATURES.map((feature) => {
            const isActive = active === feature.key;
            return (
              <article
                key={feature.key}
                data-feature-panel={feature.key}
                className="feature-panel"
                style={{
                  opacity: isActive ? 1 : 0.35,
                  transition: 'opacity .5s var(--mv-ease)',
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                    fontSize: '12px',
                    letterSpacing: '0.12em',
                    color: isActive ? 'var(--mv-warm-400)' : 'var(--mv-ink-4)',
                    transition: 'color .4s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                  }}
                >
                  {feature.num}
                  <span
                    aria-hidden="true"
                    style={{
                      height: '1px',
                      width: '48px',
                      background: isActive ? 'var(--mv-warm-500)' : 'var(--mv-line)',
                      transition: 'background .4s',
                    }}
                  />
                </div>
                <h3
                  style={{
                    fontSize: 'clamp(28px, 3.4vw, 44px)',
                    fontWeight: 500,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.08,
                    color: 'var(--mv-ink)',
                    margin: '18px 0 0',
                  }}
                >
                  {feature.title}
                </h3>
                <p
                  style={{
                    fontSize: '16px',
                    lineHeight: 1.6,
                    color: 'var(--mv-ink-2)',
                    maxWidth: '460px',
                    margin: '18px 0 0',
                  }}
                >
                  {feature.body}
                </p>
                <div style={{ display: 'flex', gap: '40px', marginTop: '28px' }}>
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
                          fontSize: '18px',
                          color: 'var(--mv-ink)',
                          fontWeight: 500,
                          textTransform: 'none',
                          letterSpacing: '-0.01em',
                          marginTop: '4px',
                        }}
                      >
                        {item.value}
                      </strong>
                    </div>
                  ))}
                </div>

                {/* Inline screenshot — mobile only (the sticky phone is hidden there) */}
                <div className="feature-panel-shot">
                  <Image
                    src={feature.screenshot}
                    alt={t('grid.screenshotAlt', { feature: feature.badgeLabel })}
                    width={360}
                    height={780}
                    sizes="(max-width: 1040px) 80vw, 360px"
                    style={{
                      width: '100%',
                      maxWidth: '320px',
                      height: 'auto',
                      borderRadius: '28px',
                      border: '1px solid var(--mv-line)',
                      boxShadow: '0 40px 80px -24px oklch(0 0 0 / 0.7)',
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>

        {/* Right: sticky phone mockup */}
        <div
          style={{ position: 'sticky', top: 'max(96px, calc(50vh - 390px))', paddingTop: '24px' }}
          className="feature-preview-wrap"
        >
          <div
            style={{
              position: 'relative',
              width: 'clamp(240px, min(50vw, 38vh), 360px)',
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
            .feature-panel {
              min-height: 64vh;
              display: flex;
              flex-direction: column;
              justify-content: center;
              padding: 48px 0;
            }
            .feature-panel-shot { display: none; }
            @media (max-width: 1040px) {
              .features-stage-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
              .feature-preview-wrap { display: none; }
              .feature-panel {
                min-height: 0;
                opacity: 1 !important;
                padding: 56px 0;
                border-bottom: 1px solid var(--mv-line-2);
              }
              .feature-panel:last-child { border-bottom: none; }
              .feature-panel-shot { display: block; margin-top: 36px; }
            }
          `,
        }}
      />
    </section>
  );
}
