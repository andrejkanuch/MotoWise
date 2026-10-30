import { useTranslations } from 'next-intl';

const FAQ_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/** Hairline `<details>` list straight on the page surface — no cards, no
 *  section marker, body face, sentence case. The section sits on the 1240
 *  edge like every other; the reading column inside is capped at 880 so the
 *  H2 starts where the neighbouring sections' H2s start. Native disclosure
 *  needs no JS, so this stays a server component; the first item ships open.
 *  The "+" turns a quarter turn into "×" when an item opens (CSS only). */
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
          {t('introTrailing')}
        </p>
      </div>

      {/* Hairline disclosure list */}
      <div className="faq-column faq-list">
        {FAQ_INDICES.map((index) => (
          <details key={index} className="faq-item" open={index === 0}>
            <summary className="faq-q">
              <span>{t(`items.${index}.question`)}</span>
              <span className="faq-mark" aria-hidden="true">
                +
              </span>
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
            .faq-mark {
              font-family: var(--mv-font-display);
              font-size: 20px;
              font-weight: 600;
              line-height: 1;
              color: var(--mv-ink-3);
              flex-shrink: 0;
              transform-origin: center;
              transition: transform 0.3s var(--mv-ease), color 0.2s;
            }
            .faq-item[open] .faq-mark { transform: rotate(45deg); color: var(--mv-ink); }
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
