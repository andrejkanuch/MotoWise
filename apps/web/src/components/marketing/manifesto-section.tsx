import { useTranslations } from 'next-intl';

/** The site definition (AI-extractable, body face, ink-3) opens the section,
 *  then the quote moment: the lead sits muted, the emphasis lands in full ink
 *  (copper is a verb — this is not one). The statement borrows the H1 size,
 *  the page's one "H2 at H1 scale" exception. No viewport lock: the block is
 *  as tall as its type. Visible by default; `.mv-reveal` adds a scroll-driven
 *  rise where the browser supports it, and the global reduced-motion rule
 *  turns it off. */
export function ManifestoSection({ definition }: { definition: string }) {
  const t = useTranslations('Manifesto');

  return (
    <section className="mv-section-inner mf-section">
      <p className="mf-definition">{definition}</p>
      <div className="mv-reveal">
        <p className="mv-section-title mf-statement">
          <span className="mv-muted">{t('lead')}</span> {t('emphasis')}
        </p>
      </div>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            .mf-section { padding-bottom: 160px; }
            .mf-definition {
              margin: 0 0 64px;
              max-width: 72ch;
              font-size: 13px;
              line-height: 18px;
              color: var(--mv-ink-3);
              text-wrap: pretty;
            }
            .mf-statement { max-width: 1000px; color: var(--mv-ink); }
            @media (max-width: 900px) {
              .mf-section { padding-bottom: 120px; }
              .mf-definition { margin-bottom: 48px; }
            }
          `,
        }}
      />
    </section>
  );
}
