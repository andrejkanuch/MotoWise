import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

export async function DiagnosticsDemo() {
  const t = await getTranslations('DiagnosticsDemo');

  return (
    <section
      id="diag"
      style={{
        padding: '200px 40px',
        maxWidth: 'var(--mv-container)',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, oklch(0.18 0.02 55), oklch(0.12 0.01 55))',
          border: '1px solid var(--mv-line)',
          borderRadius: '32px',
          padding: '80px',
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: '80px',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="diag-inner-grid"
      >
        {/* Radial glow */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 80% 20%, oklch(0.76 0.18 60 / 0.12), transparent 50%)',
            pointerEvents: 'none',
          }}
        />

        {/* Left content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* AI tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '999px',
              background: 'oklch(0.76 0.18 60 / 0.15)',
              color: 'var(--mv-warm-400)',
              fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--mv-warm-400)',
                boxShadow: '0 0 8px var(--mv-warm-400)',
              }}
            />
            {t('aiTag')}
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: 'clamp(36px, 4.5vw, 56px)',
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.035em',
              margin: '20px 0 0',
            }}
          >
            {t('titleLead')}{' '}
            <span
              style={{
                fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
                fontStyle: 'italic',
                color: 'var(--mv-warm-400)',
              }}
            >
              {t('titleEmphasis')}
            </span>
          </h2>

          <p
            style={{
              marginTop: '24px',
              color: 'var(--mv-ink-2)',
              fontSize: '17px',
              lineHeight: 1.55,
              maxWidth: '440px',
              letterSpacing: '-0.01em',
            }}
          >
            {t('description')}
          </p>

          {/* Steps */}
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[t('step1'), t('step2'), t('step3')].map((text, i) => (
              <div
                key={text}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'center',
                  fontSize: '14px',
                  color: 'var(--mv-ink-2)',
                }}
              >
                <span
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: '1px solid var(--mv-line)',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                    fontSize: '11px',
                    color: 'var(--mv-ink-3)',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Right: phone mockup with scan animation */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '340px',
            margin: '0 auto',
            aspectRatio: '9/19.5',
            borderRadius: '40px',
            background: '#080808',
            padding: '9px',
            boxShadow: '0 50px 100px -20px oklch(0 0 0 / 0.7)',
          }}
        >
          {/* Notch */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '14px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '110px',
              height: '28px',
              background: '#000',
              borderRadius: '999px',
              zIndex: 3,
            }}
          />

          {/* Screen */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '32px',
              overflow: 'hidden',
              position: 'relative',
              background: '#111',
            }}
          >
            <Image
              src="/images/marketing/mw/diagnose-hub.png"
              alt={t('screenAlt')}
              fill
              sizes="340px"
              style={{ objectFit: 'cover', objectPosition: 'top' }}
            />
          </div>

          {/* Scan line overlay */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '9px',
              borderRadius: '32px',
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--mv-warm-400), transparent)',
                boxShadow: '0 0 16px var(--mv-warm-400)',
                animation: 'mv-scan 3.2s ease-in-out infinite',
                top: '10%',
              }}
            />
          </div>

          {/* Result popup */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '20px',
              right: '20px',
              background: 'oklch(0.14 0.01 55 / 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid oklch(0.76 0.18 60 / 0.3)',
              borderRadius: '14px',
              padding: '14px',
              zIndex: 4,
              animation: 'mv-result-in 3.2s ease-in-out infinite',
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
                fontSize: '9px',
                color: 'var(--mv-warm-400)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              {t('scanComplete')}
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                marginTop: '4px',
                letterSpacing: '-0.01em',
              }}
            >
              {t('resultTitle')}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--mv-ink-3)',
                marginTop: '4px',
                lineHeight: 1.4,
              }}
            >
              {t('resultDesc')}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 900px) {
              .diag-inner-grid { grid-template-columns: 1fr !important; padding: 48px 28px !important; gap: 48px !important; }
            }
          `,
        }}
      />
    </section>
  );
}
