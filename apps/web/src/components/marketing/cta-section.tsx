import { getTranslations } from 'next-intl/server';
import { ExternalLink } from './external-link';
import { STORE_LINKS } from './store-buttons';

export async function CtaSection() {
  const t = await getTranslations('Cta');

  return (
    <section
      id="download"
      style={{
        padding: '200px 40px',
        position: 'relative',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      {/* Background image */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url("/images/marketing/cta-night.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'saturate(0.95) brightness(0.62)',
          zIndex: -2,
          transform: 'scale(1.04)',
          animation: 'mv-bg-breath 22s ease-in-out infinite alternate',
        }}
      />
      {/* Gradient overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 80% at 50% 50%, oklch(0.76 0.18 60 / 0.18), transparent 70%), linear-gradient(180deg, oklch(0.09 0.008 55 / 0.7), oklch(0.09 0.008 55 / 0.95))',
          zIndex: -1,
        }}
      />

      <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
        <div
          className="mv-section-meta"
          style={{ justifyContent: 'center', display: 'inline-flex' }}
        >
          {t('metaLabel')}
        </div>

        <h2
          style={{
            fontSize: 'clamp(56px, 8.5vw, 136px)',
            fontWeight: 500,
            letterSpacing: '-0.05em',
            lineHeight: 0.92,
            margin: '24px 0 0',
          }}
        >
          {t('headlineLead')}{' '}
          <span
            style={{
              fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--mv-warm-400)',
              letterSpacing: '-0.03em',
            }}
          >
            {t('headlineEmphasis')}
          </span>
        </h2>

        <p
          style={{
            margin: '32px auto 0',
            maxWidth: '500px',
            fontSize: '18px',
            color: 'var(--mv-ink-2)',
            lineHeight: 1.55,
            letterSpacing: '-0.01em',
          }}
        >
          {t('subtitleDownload')}
        </p>

        {/* Buttons */}
        <div
          style={{
            marginTop: '56px',
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <ExternalLink
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
            <span style={{ position: 'relative', zIndex: 1 }}>{t('appStore')}</span>
          </ExternalLink>
          <ExternalLink
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3.61 1.814L13.793 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.61-.92zM14.5 12.707l2.302 2.302-10.937 6.15 8.635-8.452zm3.476-1.414L20.6 12.89a1 1 0 010 1.72l-2.21 1.286-2.538-2.538 2.124-2.065zM5.965 3.164l10.937 6.15L14.5 11.293 5.965 3.164z" />
            </svg>
            {t('googlePlay')}
          </ExternalLink>
        </div>

        {/* Mini trust line */}
        <div
          style={{
            marginTop: '40px',
            color: 'var(--mv-ink-4)',
            fontSize: '12px',
            fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            display: 'flex',
            justifyContent: 'center',
            gap: '28px',
            flexWrap: 'wrap',
          }}
        >
          <span>
            <span style={{ color: 'var(--mv-warm-400)' }}>
              {'\u2713'}
              {'  '}
            </span>
            {t('trustFreeForever')}
          </span>
          <span>
            <span style={{ color: 'var(--mv-warm-400)' }}>
              {'\u2713'}
              {'  '}
            </span>
            {t('trustNoCreditCard')}
          </span>
          <span>
            <span style={{ color: 'var(--mv-warm-400)' }}>
              {'\u2713'}
              {'  '}
            </span>
            {t('trustUnlimitedBikes')}
          </span>
        </div>
      </div>
    </section>
  );
}
