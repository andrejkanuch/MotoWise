import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

/**
 * Diagnostics demo in the Trackside voice: content sits on the ramp (a deeper
 * band, no card wrapper), condensed display headline, plate-chip step markers
 * replaced by condensed figures, and the in-app depiction rendered as solid
 * surface panels with hairlines — status colour only on the real app status.
 */
export async function DiagnosticsDemo() {
  const t = await getTranslations('DiagnosticsDemo');

  return (
    <section id="diag" style={{ background: 'var(--mv-bg-2)' }}>
      <div
        className="diag-inner-grid"
        style={{
          padding: '160px 40px',
          maxWidth: 'var(--mv-container)',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: '80px',
          alignItems: 'center',
        }}
      >
        {/* Left content */}
        <div>
          <h2
            className="mv-display"
            style={{
              fontSize: 'clamp(40px, 4.8vw, 64px)',
              fontWeight: 700,
              lineHeight: 0.98,
              margin: 0,
            }}
          >
            {t('titleLead')} {t('titleEmphasis')}
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
          <div style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {[t('step1'), t('step2'), t('step3')].map((text, i) => (
              <div
                key={text}
                style={{
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'baseline',
                  fontSize: '15px',
                  color: 'var(--mv-ink-2)',
                }}
              >
                <span
                  className="mv-figure"
                  aria-hidden="true"
                  style={{ fontSize: '16px', color: 'var(--mv-ink-4)', flexShrink: 0 }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Right: phone mockup — flat on the ramp, hairline keyline */}
        <div className="mv-phone-mockup" style={{ margin: '0 auto' }}>
          {/* Screen */}
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '35px',
              overflow: 'hidden',
              position: 'relative',
              background: 'var(--mv-surface)',
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

          {/* Result panel — solid surface step, hairline, status colour only on
              the depicted app status */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '20px',
              right: '20px',
              background: 'var(--mv-surface-2)',
              border: '1px solid var(--mv-line)',
              borderRadius: '14px',
              padding: '14px',
              zIndex: 4,
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--mv-go)',
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
                color: 'var(--mv-ink)',
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
              .diag-inner-grid { grid-template-columns: 1fr !important; padding: 100px 24px !important; gap: 48px !important; }
            }
          `,
        }}
      />
    </section>
  );
}
