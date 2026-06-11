'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { gsap, makeMagnetic, ScrollTrigger } from './motion';
import { storeAnchorProps } from './store-buttons';

const HERO_IMAGE = '/images/marketing/hero-dusk-ride.jpg';
const HERO_IMAGE_PORTRAIT = '/images/marketing/hero-dusk-ride-portrait.jpg';

const TICKER_SPEED = 40; // seconds per loop

/** Per-character stagger for the headline — rendered server-side so the
 *  reveal works without JS and there is no hydration/animation race. */
function StaggeredChars({ text, baseDelay }: { text: string; baseDelay: number }) {
  const words = text.split(' ');
  let charIndex = 0;
  return (
    <span aria-hidden="true">
      {words.map((word, wi) => {
        const chars = Array.from(word).map((char) => {
          const delay = baseDelay + charIndex * 0.028;
          charIndex += 1;
          return (
            <span
              key={charIndex}
              className="hero-char"
              style={{ '--char-delay': `${delay}s` } as React.CSSProperties}
            >
              {char}
            </span>
          );
        });
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: static text, order never changes
            key={wi}
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              marginRight: wi < words.length - 1 ? '0.22em' : 0,
            }}
          >
            {chars}
          </span>
        );
      })}
    </span>
  );
}

export function Hero() {
  const t = useTranslations('Hero');
  const iosLink = storeAnchorProps('ios', 'hero');
  const androidLink = storeAnchorProps('android', 'hero');

  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  const tickerItems = [
    { label: t('tickerExpensesLabel'), sub: t('tickerExpensesSub') },
    { label: t('tickerMaintenanceLabel'), sub: t('tickerMaintenanceSub') },
    { label: t('tickerTripsLabel'), sub: t('tickerTripsSub') },
    { label: t('tickerDiagnosticsLabel'), sub: t('tickerDiagnosticsSub') },
    { label: t('tickerFreeLabel'), sub: t('tickerFreeSub') },
    { label: t('tickerPlatformLabel'), sub: t('tickerPlatformSub') },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Cinematic settle on the inner image; the scroll scrub animates the
      // wrapper, so the two never fight over the same transform.
      const bgImg = bgRef.current?.querySelector('img');
      if (bgImg) {
        gsap.fromTo(
          bgImg,
          { scale: 1.14, filter: 'brightness(0.55)' },
          { scale: 1, filter: 'brightness(1)', duration: 2.4, ease: 'expo.out' },
        );
      }

      // Scroll depth: background, content and HUD move at different rates.
      const scrub = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
      if (bgRef.current) scrub.to(bgRef.current, { yPercent: 14, scale: 1.06, ease: 'none' }, 0);
      if (contentRef.current) {
        scrub.to(contentRef.current, { yPercent: -10, autoAlpha: 0.25, ease: 'none' }, 0);
      }
      if (hudRef.current) scrub.to(hudRef.current, { autoAlpha: 0, ease: 'none' }, 0);

      // Valley haze: two soft layers drifting in opposite directions, breathing slowly.
      const hazeA = section.querySelector('.hero-haze-a');
      const hazeB = section.querySelector('.hero-haze-b');
      if (hazeA) {
        gsap.to(hazeA, {
          xPercent: 7,
          yPercent: -4,
          opacity: 0.85,
          duration: 26,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }
      if (hazeB) {
        gsap.to(hazeB, {
          xPercent: -9,
          yPercent: 3,
          opacity: 0.6,
          duration: 34,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
        });
      }

      // Ticker: GSAP takes over the CSS loop so scroll velocity can drive it.
      let tickerTween: gsap.core.Tween | undefined;
      if (tickerRef.current) {
        tickerRef.current.style.animation = 'none';
        tickerTween = gsap.to(tickerRef.current, {
          xPercent: -100 / 3,
          duration: TICKER_SPEED,
          ease: 'none',
          repeat: -1,
        });
      }
      const velocityST = ScrollTrigger.create({
        onUpdate: (self) => {
          if (!tickerTween) return;
          const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 900, 4);
          gsap.to(tickerTween, { timeScale: boost, duration: 0.4, overwrite: true });
        },
      });

      // Pointer parallax + magnetic CTAs (fine pointers only).
      const cleanups: Array<() => void> = [];
      if (window.matchMedia('(pointer: fine)').matches) {
        if (bgRef.current && contentRef.current) {
          const bgX = gsap.quickTo(bgRef.current, 'x', { duration: 1.2, ease: 'power3.out' });
          const bgY = gsap.quickTo(bgRef.current, 'y', { duration: 1.2, ease: 'power3.out' });
          const fgX = gsap.quickTo(contentRef.current, 'x', { duration: 1, ease: 'power3.out' });
          const fgY = gsap.quickTo(contentRef.current, 'y', { duration: 1, ease: 'power3.out' });
          const onParallax = (e: PointerEvent) => {
            const nx = e.clientX / window.innerWidth - 0.5;
            const ny = e.clientY / window.innerHeight - 0.5;
            bgX(nx * -14);
            bgY(ny * -10);
            fgX(nx * 6);
            fgY(ny * 4);
          };
          section.addEventListener('pointermove', onParallax);
          cleanups.push(() => section.removeEventListener('pointermove', onParallax));
        }
        for (const wrap of section.querySelectorAll<HTMLElement>('[data-magnetic]')) {
          cleanups.push(makeMagnetic(wrap));
        }
      }

      return () => {
        velocityST.kill();
        tickerTween?.kill();
        for (const fn of cleanups) fn();
      };
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        minHeight: '100svh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '120px 40px 96px',
        isolation: 'isolate',
      }}
      className="hero-section"
    >
      {/* Background image — desktop landscape / mobile portrait */}
      <div
        ref={bgRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-24px',
          zIndex: -3,
          willChange: 'transform',
        }}
      >
        <picture>
          <source media="(max-aspect-ratio: 4/5)" srcSet={HERO_IMAGE_PORTRAIT} />
          <img
            src={HERO_IMAGE}
            alt=""
            fetchPriority="high"
            decoding="async"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 60%',
            }}
          />
        </picture>
      </div>

      {/* Scrims: text contrast on the left, fade to page background below */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -2,
          background: `
            linear-gradient(90deg, oklch(0.07 0.008 55 / 0.72) 0%, oklch(0.07 0.008 55 / 0.28) 44%, transparent 70%),
            linear-gradient(180deg, oklch(0.07 0.008 55 / 0.55) 0%, transparent 22%, transparent 55%, oklch(0.09 0.008 55 / 0.92) 92%, var(--mv-bg-2) 100%)
          `,
        }}
      />

      {/* Drifting valley haze */}
      <div className="hero-haze hero-haze-a" aria-hidden="true" />
      <div className="hero-haze hero-haze-b" aria-hidden="true" />

      {/* HUD corner labels */}
      <div ref={hudRef} aria-hidden="true">
        <span className="hero-hud mv-mono" style={{ top: '96px', left: '40px' }}>
          MotoVault · v3.0
        </span>
        <span className="hero-hud mv-mono" style={{ top: '96px', right: '40px' }}>
          {t('cornerFreePlatforms')}
        </span>
      </div>

      {/* Main content */}
      <div
        ref={contentRef}
        style={{
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
        }}
      >
        {/* Eyebrow badge */}
        <a href="#features" className="hero-eyebrow">
          <span className="hero-eyebrow-tag">{t('tickerExpensesLabel')}</span>
          {t('badgeExpensesHook')}
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
        </a>

        {/* Headline — chars rendered server-side, staggered via CSS vars */}
        <h1
          style={{
            fontSize: 'clamp(52px, min(9.2vw, 17vh), 150px)',
            fontWeight: 500,
            lineHeight: 0.92,
            letterSpacing: '-0.045em',
            margin: '28px 0 0',
            color: 'var(--mv-ink)',
            maxWidth: '12ch',
          }}
        >
          <span className="sr-only">
            {t('titleLine1')} {t('titleLine2')}
          </span>
          <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.06em' }}>
            <StaggeredChars text={t('titleLine1')} baseDelay={0.15} />
          </span>
          <span style={{ display: 'block', overflow: 'hidden', padding: '0 0.06em 0.12em 0' }}>
            <span className="hero-line2" aria-hidden="true">
              {t('titleLine2')}
            </span>
          </span>
        </h1>

        {/* Description */}
        <p className="hero-desc">{t('description')}</p>

        {/* CTAs */}
        <div className="hero-cta-row">
          <span data-magnetic style={{ display: 'inline-block' }}>
            <a {...iosLink} className="mv-btn hero-btn-copper">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <span>{t('downloadIos')}</span>
            </a>
          </span>
          <span data-magnetic style={{ display: 'inline-block' }}>
            <a {...androidLink} className="mv-btn mv-btn-ghost">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92zM14.5 12.707l2.302 2.302-10.937 6.15 8.635-8.452zm3.476-1.414L20.6 12.89a1 1 0 010 1.72l-2.21 1.286-2.538-2.538 2.124-2.065zM5.965 3.164l10.937 6.15L14.5 11.293 5.965 3.164z" />
              </svg>
              Google Play
            </a>
          </span>
        </div>

        {/* Trust line */}
        <div className="hero-trust mv-mono">
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--mv-success)',
              boxShadow: '0 0 8px var(--mv-success)',
              animation: 'mv-pulse 2s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
          <span>{t('trustLineStrip')}</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="hero-scroll mv-mono" aria-hidden="true">
        <span>{t('scrollDown')}</span>
        <span className="hero-scroll-track">
          <span className="hero-scroll-thumb" />
        </span>
      </div>

      {/* Telemetry ticker */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '18px 0',
          borderTop: '1px solid var(--mv-line)',
          background: 'oklch(0.08 0.008 55 / 0.55)',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        <div
          ref={tickerRef}
          style={{
            display: 'flex',
            gap: '48px',
            whiteSpace: 'nowrap',
            width: 'max-content',
            paddingLeft: '40px',
            animation: `mv-ticker-roll ${TICKER_SPEED}s linear infinite`,
          }}
        >
          {[0, 1, 2].map((dup) => (
            <span
              key={dup}
              aria-hidden={dup > 0}
              style={{ display: 'inline-flex', gap: '48px', alignItems: 'center' }}
            >
              {tickerItems.map((item) => (
                <span
                  key={item.label}
                  className="mv-mono"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '14px',
                    color: 'var(--mv-ink-3)',
                    fontSize: '13px',
                    letterSpacing: '0.02em',
                  }}
                >
                  <strong style={{ color: 'var(--mv-ink)', fontWeight: 500 }}>{item.label}</strong>
                  {item.sub}
                  <span
                    style={{
                      width: '3px',
                      height: '3px',
                      borderRadius: '50%',
                      background: 'var(--mv-warm-500)',
                    }}
                  />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
