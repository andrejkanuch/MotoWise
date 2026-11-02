import { useTranslations } from 'next-intl';

/** The six home-page questions, by `Faq.items` index, strongest first so the
 *  JSON-LD FAQPage (built from the same list in page.tsx) leads with them:
 *  what it is, is it free, reminders, several bikes, vs REVER/Calimoto, data. */
export const HOME_FAQ_ITEMS = [0, 1, 8, 9, 7, 4] as const;

/** Hairline `<details>` list straight on the page surface — no cards, no
 *  section marker, body face, sentence case. The section sits on the 1240
 *  edge like every other; the reading column inside is capped at 880 so the
 *  H2 starts where the neighbouring sections' H2s start. Native disclosure
 *  needs no JS, so this stays a server component; the first item ships open.
 *  The kit's `.mv-disclosure.is-plus` turns the "+" into "×" on open. */
export function Faq() {
  const t = useTranslations('Faq');

  return (
    <section id="faq" className="faq-section">
      <div className="faq-column">
        <h2 className="mv-h2">
          {t('titleLead')} <span className="faq-muted">{t('titleAccent')}</span>
        </h2>
        <p className="mv-section-sub">
          {t('introLead')}{' '}
          <a href="mailto:support@motovault.app" className="mv-link">
            {t('introLink')}
          </a>
          .
        </p>
      </div>

      {/* Hairline disclosure list */}
      <div className="faq-column faq-list">
        {HOME_FAQ_ITEMS.map((index, position) => (
          <details key={index} className="faq-item mv-disclosure is-plus" open={position === 0}>
            <summary className="faq-q">
              <span>{t(`items.${index}.question`)}</span>
              <span className="faq-mark mv-disclosure-mark" aria-hidden="true" />
            </summary>
            <div className="faq-a">{t(`items.${index}.answer`)}</div>
          </details>
        ))}
      </div>

      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            .faq-section { max-width: var(--mv-container); margin: 0 auto; padding: 120px 40px; }
            .faq-column { max-width: 880px; }
            .faq-muted { color: var(--mv-ink-3); }
            .faq-list { margin-top: 64px; border-top: 1px solid var(--mv-line); }
            .faq-item { border-bottom: 1px solid var(--mv-line); }
            .faq-q {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              gap: 20px;
              min-height: 44px;
              padding: 20px 0;
              font-family: var(--mv-font-body);
              font-size: 17px;
              font-weight: 600;
              line-height: 1.45;
              letter-spacing: 0;
              color: var(--mv-ink);
              cursor: pointer;
              list-style: none;
            }
            .faq-q::-webkit-details-marker { display: none; }
            .faq-q:hover { color: var(--mv-copper-text); }
            /* A 16px plus drawn in two 2px bars (a glyph rendered ~8px in
               the condensed face); the kit turns it to × on open. */
            .faq-mark {
              position: relative;
              width: 16px;
              height: 16px;
              /* centred on the question's first line (17px × 1.45) */
              align-self: flex-start;
              margin-top: 4px;
              color: var(--mv-ink-2);
              flex-shrink: 0;
              transform-origin: center;
            }
            .faq-mark::before,
            .faq-mark::after {
              content: '';
              position: absolute;
              left: 0;
              top: 7px;
              width: 16px;
              height: 2px;
              border-radius: 1px;
              background: currentColor;
            }
            .faq-mark::after { transform: rotate(90deg); }
            .faq-item[open] .faq-mark { color: var(--mv-ink); }
            .faq-a {
              padding: 0 0 24px;
              color: var(--mv-ink-2);
              font-size: 16px;
              line-height: 1.55;
              max-width: 62ch;
              letter-spacing: 0;
              text-wrap: pretty;
            }
            @media (max-width: 900px) {
              .faq-section { padding: 96px 24px; }
              .faq-list { margin-top: 48px; }
            }
            @media (max-width: 480px) {
              .faq-section { padding: 96px 20px; }
            }
          `,
        }}
      />
    </section>
  );
}
