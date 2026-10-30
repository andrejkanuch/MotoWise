import { useTranslations } from 'next-intl';

/** Full-viewport quote moment set in the display face: the lead sits muted,
 *  the emphasis lands in full ink (copper is a verb — this is not one).
 *  Visible by default; `.mv-reveal` adds a scroll-driven rise where the
 *  browser supports it, and the global reduced-motion rule turns it off. */
export function ManifestoSection() {
  const t = useTranslations('Manifesto');

  return (
    <section
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        padding: '120px 40px',
        maxWidth: 'var(--mv-container)',
        margin: '0 auto',
      }}
    >
      <div className="mv-reveal">
        <p
          style={{
            fontFamily: 'var(--mv-font-display)',
            fontWeight: 700,
            fontSize: 'clamp(44px, 6vw, 96px)',
            lineHeight: 0.98,
            letterSpacing: '0.002em',
            margin: 0,
            maxWidth: '1000px',
            color: 'var(--mv-ink-3)',
          }}
        >
          {t('lead')} <span style={{ color: 'var(--mv-ink)' }}>{t('emphasis')}</span>
        </p>
      </div>
    </section>
  );
}
