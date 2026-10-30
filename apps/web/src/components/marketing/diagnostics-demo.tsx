import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

const DIAG_SCREEN = '/images/marketing/mw/diagnose-hub.png';
const DIAG_SCREEN_WIDTH = 1206;
const DIAG_SCREEN_HEIGHT = 2322;

/**
 * Diagnostics in the Trackside voice: content sits on a deeper step of the
 * ramp (no card wrapper, no gradient), a condensed headline, the three steps
 * as a numbered list, and the app depicted as a screen cut by the band's
 * bottom edge — the page's one full device frame is spent in the features
 * sequence. The in-app result panel is a solid surface step with a hairline;
 * the only status colour is the app's own "scan complete" state.
 */
export async function DiagnosticsDemo() {
  const t = await getTranslations('DiagnosticsDemo');
  const steps = [t('step1'), t('step2'), t('step3')];

  return (
    <section id="diag" className="diag-band">
      <div className="diag-grid">
        <div className="diag-copy">
          <h2
            className="mv-display"
            style={{
              fontSize: 'clamp(40px, 4.8vw, 64px)',
              fontWeight: 700,
              lineHeight: 0.98,
              margin: 0,
              color: 'var(--mv-ink)',
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

          <ol className="diag-steps">
            {steps.map((text, i) => (
              <li key={text} className="diag-step">
                <span className="mv-figure diag-step-num" aria-hidden="true">
                  {i + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </div>

        {/* The app screen, cut by the band's bottom edge, hairline keyline */}
        <div className="diag-screen">
          <Image
            src={DIAG_SCREEN}
            alt={t('screenAlt')}
            width={DIAG_SCREEN_WIDTH}
            height={DIAG_SCREEN_HEIGHT}
            sizes="(max-width: 900px) 300px, 360px"
            className="diag-screen-img"
          />

          {/* Result panel: one step up the ramp, hairline, status on the
              depicted app state only */}
          <div className="diag-result">
            <div className="diag-status">
              <span className="diag-status-dot" aria-hidden="true" />
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
                fontSize: '12px',
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

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            .diag-band { background: var(--mv-bg-2); overflow: hidden; }
            .diag-grid {
              max-width: var(--mv-container);
              margin: 0 auto;
              padding: 0 40px;
              display: grid;
              grid-template-columns: 1.1fr 1fr;
              gap: 80px;
              align-items: end;
            }
            .diag-copy { padding: 160px 0; }
            .diag-steps {
              list-style: none;
              margin: 40px 0 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              gap: 18px;
            }
            .diag-step {
              display: flex;
              gap: 14px;
              align-items: baseline;
              font-size: 15px;
              color: var(--mv-ink-2);
            }
            .diag-step-num { font-size: 18px; color: var(--mv-ink-4); flex-shrink: 0; min-width: 14px; }
            .diag-screen {
              position: relative;
              width: 360px;
              max-width: 100%;
              height: 560px;
              margin: 96px auto 0;
              overflow: hidden;
              border: 1px solid var(--mv-line);
              border-bottom: 0;
              border-radius: 28px 28px 0 0;
              background: var(--mv-surface);
            }
            .diag-screen-img { width: 100%; height: auto; display: block; }
            .diag-status {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              font-weight: 500;
              color: var(--mv-ink-2);
            }
            .diag-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mv-go); }
            .diag-result {
              position: absolute;
              left: 16px;
              right: 16px;
              bottom: 24px;
              background: var(--mv-surface-2);
              border: 1px solid var(--mv-line);
              border-radius: var(--mv-radius-inner);
              padding: 14px;
            }
            @media (max-width: 900px) {
              .diag-grid { grid-template-columns: 1fr; padding: 0 24px; gap: 0; }
              .diag-copy { padding: 100px 0 0; }
              .diag-screen { width: 300px; height: 420px; margin: 48px 0 0; }
            }
            @media (max-width: 480px) {
              .diag-screen { width: 100%; height: 360px; }
            }
          `,
        }}
      />
    </section>
  );
}
