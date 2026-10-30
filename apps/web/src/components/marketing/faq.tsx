import { useTranslations } from 'next-intl';

const FAQ_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/** Hairline `<details>` list straight on the page surface — no cards, body
 *  face, sentence case. Native disclosure needs no JS, so this stays a
 *  server component; the first item ships open. */
export function Faq() {
  const t = useTranslations('Faq');

  return (
    <section
      id="faq"
      style={{
        padding: '120px 40px 160px',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      {/* Section header */}
      <div>
        <div className="mv-section-meta">
          <span className="mv-plate-chip">02</span>
        </div>
        <h2 className="mv-section-title">
          {t('titleLead')} <span className="mv-muted">{t('titleAccent')}</span>
        </h2>
        <p
          style={{
            margin: '28px 0 0',
            color: 'var(--mv-ink-2)',
            fontSize: '18px',
            lineHeight: 1.55,
            maxWidth: '620px',
            letterSpacing: '-0.01em',
          }}
        >
          {t('introLead')}{' '}
          <a
            href="mailto:support@motovault.app"
            style={{ color: 'var(--mv-copper-text)', textDecoration: 'none' }}
          >
            {t('introLink')}
          </a>
          {t('introTrailing')}
        </p>
      </div>

      {/* Hairline disclosure list */}
      <div style={{ marginTop: '64px', borderTop: '1px solid var(--mv-line)' }}>
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
            .faq-item { border-bottom: 1px solid var(--mv-line); }
            .faq-q {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              gap: 20px;
              padding: 26px 0;
              font-family: var(--mv-font-body);
              font-size: 19px;
              font-weight: 500;
              letter-spacing: -0.015em;
              color: var(--mv-ink);
              cursor: pointer;
              list-style: none;
            }
            .faq-q::-webkit-details-marker { display: none; }
            .faq-q:hover { color: var(--mv-copper-text); }
            .faq-mark {
              font-family: var(--mv-font-display);
              font-size: 22px;
              font-weight: 600;
              line-height: 1;
              color: var(--mv-ink-3);
              flex-shrink: 0;
              transition: transform 0.3s var(--mv-ease);
            }
            .faq-item[open] .faq-mark { transform: rotate(45deg); }
            .faq-a {
              padding: 0 0 28px;
              color: var(--mv-ink-2);
              font-size: 16px;
              line-height: 1.6;
              max-width: 680px;
              letter-spacing: -0.005em;
            }
          `,
        }}
      />
    </section>
  );
}
