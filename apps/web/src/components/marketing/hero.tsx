'use client';

import { useEffect, useState } from 'react';
import { STORE_LINKS } from './store-buttons';

const HERO_IMAGES = [
  '/images/marketing/hero-rider.jpg',
  '/images/marketing/hero-d.jpg',
  '/images/marketing/hero-h.jpg',
  '/images/marketing/hero-night.jpg',
  '/images/marketing/hero-street.jpg',
];

const TICKER_ITEMS = [
  { label: '2,400+', sub: 'RIDERS' },
  { label: '18K', sub: 'BIKES TRACKED' },
  { label: '40', sub: 'COUNTRIES' },
  { label: '12K+', sub: 'SERVICES LOGGED' },
  { label: '< 5s', sub: 'AI DIAGNOSIS' },
  { label: '4.8\u2605', sub: 'APP STORE' },
  { label: 'FREE', sub: 'FOREVER' },
];

export function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5500);
    return () => clearInterval(interval);
  }, []);

  const tickerHtml = TICKER_ITEMS.map(
    (i) =>
      `<span style="display:inline-flex;align-items:center;gap:14px;color:var(--mv-ink-3);font-size:13px;font-family:var(--font-geist-mono,'Geist Mono',monospace);letter-spacing:0.02em"><strong style="color:var(--mv-ink);font-weight:500">${i.label}</strong> ${i.sub} <span style="width:3px;height:3px;border-radius:50%;background:var(--mv-warm-500)"></span></span>`,
  ).join('');

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        padding: '160px 40px 80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        isolation: 'isolate',
      }}
    >
      {/* Background slideshow */}
      <div style={{ position: 'absolute', inset: 0, zIndex: -3, overflow: 'hidden' }}>
        {HERO_IMAGES.map((src, idx) => (
          <div
            key={src}
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url('${src}')`,
              backgroundSize: 'cover',
              backgroundPosition:
                idx === 0 ? 'center 55%' : idx === 1 || idx === 3 ? 'center 50%' : 'center 55%',
              filter: 'saturate(0.9) brightness(0.5) contrast(1.12)',
              opacity: activeSlide === idx ? 1 : 0,
              transform: 'scale(1.08)',
              transition: 'opacity 1.6s ease',
              willChange: 'opacity, transform',
              animation: activeSlide === idx ? 'mv-bg-breath 12s ease-in-out forwards' : 'none',
            }}
          />
        ))}
      </div>

      {/* Motion streaks */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -2,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(90deg, transparent 0 40px, oklch(1 0 0 / 0.018) 40px 41px, transparent 41px 80px)',
          mixBlendMode: 'screen',
          opacity: 0.7,
          maskImage:
            'linear-gradient(90deg, transparent 0%, black 20%, black 80%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(90deg, transparent 0%, black 20%, black 80%, transparent 100%)',
          animation: 'mv-streak-flow 1.2s linear infinite',
        }}
      />

      {/* Gradient overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -2,
          background:
            'radial-gradient(ellipse 90% 60% at 30% 40%, oklch(0.76 0.18 60 / 0.12), transparent 60%), linear-gradient(180deg, oklch(0.09 0.008 55 / 0.4) 0%, oklch(0.09 0.008 55 / 0.2) 50%, oklch(0.09 0.008 55 / 0.95) 100%)',
        }}
      />

      {/* Grid noise pattern */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(to right, oklch(1 0 0 / 0.025) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.025) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 80% 100% at 50% 50%, black, transparent 85%)',
          opacity: 0.6,
        }}
      />

      {/* Corner labels */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
          fontSize: '11px',
          color: 'oklch(0.88 0.01 55 / 0.72)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '6px 10px',
          borderRadius: '999px',
          background: 'oklch(0.08 0.008 55 / 0.4)',
          backdropFilter: 'blur(10px) saturate(140%)',
          border: '1px solid oklch(1 0 0 / 0.08)',
          textShadow: '0 1px 2px oklch(0 0 0 / 0.5)',
          zIndex: 2,
          top: '100px',
          left: '40px',
        }}
        className="hidden lg:block"
      >
        MotoVault &middot; v3.0
      </div>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
          fontSize: '11px',
          color: 'oklch(0.88 0.01 55 / 0.72)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          padding: '6px 10px',
          borderRadius: '999px',
          background: 'oklch(0.08 0.008 55 / 0.4)',
          backdropFilter: 'blur(10px) saturate(140%)',
          border: '1px solid oklch(1 0 0 / 0.08)',
          textShadow: '0 1px 2px oklch(0 0 0 / 0.5)',
          zIndex: 2,
          top: '100px',
          right: '40px',
        }}
        className="hidden lg:block"
      >
        Free &middot; iOS &middot; Android
      </div>

      {/* Top content */}
      <div style={{ maxWidth: 'var(--mv-container)', margin: '0 auto', width: '100%' }}>
        {/* Eyebrow badge */}
        <a
          href="#diag"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '6px 16px 6px 6px',
            borderRadius: '999px',
            background: 'oklch(1 0 0 / 0.04)',
            border: '1px solid var(--mv-line)',
            backdropFilter: 'blur(12px)',
            fontSize: '13px',
            color: 'var(--mv-ink-2)',
            fontWeight: 500,
            letterSpacing: '-0.01em',
            textDecoration: 'none',
            transition: 'background .2s, border-color .2s',
            opacity: 0,
            transform: 'translateY(8px)',
            animation: 'mv-rise .8s .1s var(--mv-ease-expo) forwards',
          }}
        >
          <span
            style={{
              background: 'var(--mv-warm-500)',
              color: 'oklch(0.18 0.02 55)',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            New
          </span>
          AI photo diagnostics is live
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: 'var(--mv-ink-3)',
              transition: 'transform .3s var(--mv-ease), color .2s',
            }}
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>

        {/* Giant title */}
        <h1
          style={{
            fontSize: 'clamp(64px, 11vw, 176px)',
            fontWeight: 500,
            lineHeight: 0.88,
            letterSpacing: '-0.05em',
            margin: '40px 0 0',
            color: 'var(--mv-ink)',
          }}
        >
          <span style={{ display: 'block', overflow: 'hidden' }}>
            <span
              style={{
                display: 'inline-block',
                transform: 'translateY(105%)',
                animation: 'mv-title-reveal 1.2s var(--mv-ease-expo) forwards',
                animationDelay: '.2s',
              }}
            >
              The rider&apos;s
            </span>
          </span>
          <span style={{ display: 'block', overflow: 'hidden' }}>
            <span
              style={{
                display: 'inline-block',
                transform: 'translateY(105%)',
                animation: 'mv-title-reveal 1.2s var(--mv-ease-expo) forwards',
                animationDelay: '.32s',
              }}
            >
              <em
                className="mv-serif"
                style={{
                  fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
                  fontWeight: 400,
                  fontStyle: 'italic',
                  letterSpacing: '-0.03em',
                }}
              >
                companion.
              </em>
            </span>
          </span>
        </h1>
      </div>

      {/* Bottom grid */}
      <div
        style={{
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '48px',
          alignItems: 'end',
          paddingTop: '64px',
        }}
        className="hero-bottom-grid"
      >
        <p
          style={{
            maxWidth: '440px',
            fontSize: '17px',
            lineHeight: 1.5,
            color: 'var(--mv-ink-2)',
            margin: 0,
            letterSpacing: '-0.01em',
            opacity: 0,
            transform: 'translateY(12px)',
            animation: 'mv-rise 1s 1s var(--mv-ease-expo) forwards',
          }}
        >
          Trip planning, maintenance, expenses and AI diagnostics — the four tools every
          motorcyclist needs, in one beautifully simple app.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            justifySelf: 'end',
            opacity: 0,
            transform: 'translateY(12px)',
            animation: 'mv-rise 1s 1.2s var(--mv-ease-expo) forwards',
          }}
          className="hero-actions-wrap"
        >
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href={STORE_LINKS.appStore}
              className="mv-btn mv-btn-primary"
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 22px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
                border: 'none',
                letterSpacing: '-0.005em',
                overflow: 'hidden',
                background: 'var(--mv-ink)',
                color: 'oklch(0.15 0.02 55)',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                style={{ position: 'relative', zIndex: 1 }}
              >
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <span style={{ position: 'relative', zIndex: 1 }}>Download for iOS</span>
            </a>
            <a
              href={STORE_LINKS.googlePlay}
              className="mv-btn mv-btn-ghost"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px 22px',
                borderRadius: '999px',
                fontWeight: 600,
                fontSize: '14px',
                textDecoration: 'none',
                letterSpacing: '-0.005em',
                background: 'oklch(1 0 0 / 0.04)',
                color: 'var(--mv-ink)',
                border: '1px solid var(--mv-line)',
                backdropFilter: 'blur(8px)',
              }}
            >
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
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              color: 'var(--mv-ink-3)',
              fontSize: '12px',
              fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
              letterSpacing: '0.02em',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--mv-success)',
                boxShadow: '0 0 8px var(--mv-success)',
                animation: 'mv-pulse 2s ease-in-out infinite',
              }}
            />
            <span>2,400+ RIDERS &middot; 40 COUNTRIES &middot; 4.8&#9733;</span>
          </div>
        </div>
      </div>

      {/* Ticker strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px 40px',
          borderTop: '1px solid var(--mv-line)',
          background: 'oklch(0.08 0.008 55 / 0.5)',
          backdropFilter: 'blur(12px)',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '48px',
            whiteSpace: 'nowrap',
            animation: 'mv-ticker-roll 40s linear infinite',
            width: 'max-content',
          }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static ticker content
          dangerouslySetInnerHTML={{ __html: tickerHtml + tickerHtml + tickerHtml }}
        />
      </div>

      {/* Responsive overrides */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 820px) {
              .hero-bottom-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
              .hero-actions-wrap { justify-self: start !important; }
            }
          `,
        }}
      />
    </section>
  );
}
