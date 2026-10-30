import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

const DIAG_SCREEN = '/images/marketing/mw/diagnose-hub.png';
const DIAG_SCREEN_WIDTH = 1206;
const DIAG_SCREEN_HEIGHT = 2322;

/**
 * Diagnostics in the Trackside voice: content sits on a deeper step of the
 * ramp (no card wrapper, no gradient), a condensed headline, the three steps
 * as a numbered list, and the app depicted as a screen hanging from the
 * band's top edge on the left — the mirror of the rides band, so the page
 * never repeats a stage. The page's one full device frame is spent in the
 * features sequence. The in-app result panel is a solid surface step with a
 * hairline; the only status colour is the app's own "scan complete" state.
 */
export async function DiagnosticsDemo() {
  const t = await getTranslations('DiagnosticsDemo');
  const steps = [t('step1'), t('step2'), t('step3')];

  return (
    <section id="diag" className="diag-band">
      <div className="diag-grid">
        <div className="diag-copy">
          <h2 className="mv-h2">
            {t('titleLead')} {t('titleEmphasis')}
          </h2>

          <p className="mv-section-sub" style={{ maxWidth: '440px' }}>
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
            <div className="diag-result-title">{t('resultTitle')}</div>
            <div className="diag-result-desc">{t('resultDesc')}</div>
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
              grid-template-columns: 1fr 1.1fr;
              gap: 64px;
              align-items: start;
            }
            .diag-copy { padding: 120px 0; }
            .diag-steps {
              list-style: none;
              margin: 40px 0 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .diag-step {
              display: flex;
              gap: 16px;
              align-items: baseline;
              font-size: 15px;
              line-height: 1.45;
              color: var(--mv-ink-2);
            }
            .diag-step-num { font-size: 20px; line-height: 22px; color: var(--mv-ink-4); flex-shrink: 0; min-width: 16px; }
            /* The screen hangs from the band's top edge: cut at the top,
               keyline on the three visible sides. */
            .diag-screen {
              order: -1;
              align-self: start;
              position: relative;
              width: 360px;
              max-width: 100%;
              height: 560px;
              margin: 0 0 96px;
              overflow: hidden;
              border: 1px solid var(--mv-line);
              border-top: 0;
              border-radius: 0 0 var(--mv-radius-screen) var(--mv-radius-screen);
              background: var(--mv-surface);
            }
            .diag-screen-img { width: 100%; height: auto; display: block; margin-top: -56px; }
            .diag-status {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 13px;
              line-height: 18px;
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
              border-radius: var(--mv-radius-control);
              padding: 12px;
            }
            .diag-result-title { margin-top: 4px; font-size: 15px; font-weight: 600; line-height: 1.4; letter-spacing: 0; color: var(--mv-ink); }
            .diag-result-desc {
              margin-top: 4px;
              font-size: 13px;
              line-height: 18px;
              color: var(--mv-ink-3);
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            @media (max-width: 900px) {
              .diag-grid { grid-template-columns: 1fr; padding: 0 24px; gap: 0; }
              .diag-copy { padding: 0 0 96px; }
              .diag-screen { width: 300px; height: 420px; margin: 0 0 48px; }
            }
            @media (max-width: 480px) {
              .diag-grid { padding: 0 20px; }
              .diag-screen { width: 100%; height: 420px; }
              .diag-result { left: 12px; right: 12px; bottom: 16px; }
            }
          `,
        }}
      />
    </section>
  );
}
