import { useTranslations } from 'next-intl';

/** The quote moment: the lead sits muted, the emphasis lands in full ink
 *  (copper is a verb — this is not one). The statement borrows the H1 size,
 *  the page's one "H2 at H1 scale" exception. No viewport lock: the block is
 *  as tall as its type. Visible by default; `.mv-reveal` adds a scroll-driven
 *  rise where the browser supports it, and the kit's reduced-motion policy
 *  turns it off. The site definition is not here: crawlers get it from the
 *  JSON-LD, the metadata description and FAQ 0. */
export function ManifestoSection() {
  const t = useTranslations('Manifesto');

  return (
    <section className="mv-section-inner mf-section">
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
            .mf-statement { max-width: 1000px; color: var(--mv-ink); }
            @media (max-width: 900px) {
              .mf-section { padding-bottom: 120px; }
            }
          `,
        }}
      />
    </section>
  );
}
