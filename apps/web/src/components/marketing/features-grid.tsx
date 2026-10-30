'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger } from './motion';

type FeatureKey = 'expenses' | 'maintenance' | 'rides' | 'trip';

interface FeatureData {
  key: FeatureKey;
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

/** Floating chips sit one step up the ramp: solid raised surface, hairline
 *  keyline, no blur, no glow (Ramp Is the Shadow Rule). */
const FLOATING_CHIP_BASE: CSSProperties = {
  position: 'absolute',
  zIndex: 4,
  background: 'var(--mv-surface-2)',
  border: '1px solid var(--mv-line)',
  borderRadius: 'var(--mv-radius-control)',
  padding: '12px 16px',
};

export function FeaturesGrid() {
  const t = useTranslations('Features');
  const [active, setActive] = useState<FeatureKey>('expenses');
  const [chipsVisible, setChipsVisible] = useState(true);
  const panelsRef = useRef<HTMLDivElement>(null);

  const FEATURES: FeatureData[] = KEYS.map((key) => ({
    key,
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
            duration: 0.7,
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
      {/* Section header — the plate chip is the one sanctioned section marker */}
      <div style={{ maxWidth: '880px' }}>
        <div className="mv-section-meta">
          <span className="mv-plate-chip">01</span>
        </div>
        <h2 className="mv-section-title">
          {t('grid.sectionTitleLead')}{' '}
          <span className="mv-muted">{t('grid.sectionTitleEmphasis')}</span>
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
                <h3
                  style={{
                    fontFamily: 'var(--mv-font-display)',
                    fontSize: 'clamp(30px, 3.4vw, 46px)',
                    fontWeight: 600,
                    letterSpacing: '0.002em',
                    lineHeight: 1.02,
                    color: 'var(--mv-ink)',
                    margin: 0,
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
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'var(--mv-ink-3)',
                      }}
                    >
                      {item.label}
                      <strong
                        style={{
                          display: 'block',
                          fontSize: '17px',
                          color: 'var(--mv-ink)',
                          fontWeight: 600,
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
            }}
          >
            {/* Active-feature label: solid chip on the raised step */}
            <div
              style={{
                position: 'absolute',
                top: '-14px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--mv-ink-2)',
                background: 'var(--mv-surface-2)',
                border: '1px solid var(--mv-line)',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}
            >
              {activeFeature.badgeLabel}
            </div>

            {/* Floating chip 1 */}
            <div
              style={{
                ...FLOATING_CHIP_BASE,
                top: '22%',
                left: '-80px',
                opacity: chipsVisible ? 1 : 0,
                transform: chipsVisible ? 'translateY(0)' : 'translateY(16px)',
                transition: 'opacity .6s var(--mv-ease-expo), transform .6s var(--mv-ease-expo)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--mv-ink-3)' }}>
                {activeFeature.chip1.label}
              </div>
              <div
                className="mv-figure"
                style={{ fontSize: '17px', color: 'var(--mv-ink)', marginTop: '2px' }}
              >
                {activeFeature.chip1.value}
              </div>
            </div>

            {/* Floating chip 2 */}
            <div
              style={{
                ...FLOATING_CHIP_BASE,
                bottom: '18%',
                right: '-60px',
                opacity: chipsVisible ? 1 : 0,
                transform: chipsVisible ? 'translateY(0)' : 'translateY(16px)',
                transition:
                  'opacity .6s .08s var(--mv-ease-expo), transform .6s .08s var(--mv-ease-expo)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--mv-ink-3)' }}>
                {activeFeature.chip2.label}
              </div>
              <div
                className="mv-figure"
                style={{ fontSize: '17px', color: 'var(--mv-ink)', marginTop: '2px' }}
              >
                {activeFeature.chip2.value}
              </div>
            </div>

            {/* Phone frame — the page's one full device frame */}
            <div className="mv-phone-mockup" style={{ width: '100%', zIndex: 1 }}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '35px',
                  overflow: 'hidden',
                  background: 'var(--mv-surface)',
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
                      transition: 'opacity .5s var(--mv-ease-expo)',
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
