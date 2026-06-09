'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

const FAQ_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function Faq() {
  const t = useTranslations('Faq');
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section
      id="faq"
      style={{
        padding: '120px 40px 160px',
        maxWidth: '960px',
        margin: '0 auto',
      }}
    >
      {/* Split header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.2fr',
          gap: '80px',
          alignItems: 'end',
        }}
        className="faq-head-grid"
      >
        <div>
          <div className="mv-section-meta">{t('sectionMeta')}</div>
          <h2 className="mv-section-title">
            {t('titleLead')} <span className="mv-serif mv-muted">{t('titleAccent')}</span>
          </h2>
        </div>
        <p
          style={{
            margin: 0,
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
            style={{ color: 'var(--mv-warm-400)', textDecoration: 'none' }}
          >
            {t('introLink')}
          </a>
          {t('introTrailing')}
        </p>
      </div>

      {/* Accordion */}
      <div style={{ marginTop: '64px', borderTop: '1px solid var(--mv-line)' }}>
        {FAQ_INDICES.map((index) => {
          const isOpen = openIndex === index;
          const question = t(`items.${index}.question`);
          return (
            <div key={question} style={{ borderBottom: '1px solid var(--mv-line)' }}>
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                style={{
                  width: '100%',
                  padding: '32px 0',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  fontSize: '22px',
                  fontWeight: 400,
                  letterSpacing: '-0.025em',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'color .25s',
                }}
                id={`faq-question-${index}`}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${index}`}
              >
                {question}
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: isOpen ? '1px solid var(--mv-warm-500)' : '1px solid var(--mv-line)',
                    display: 'grid',
                    placeItems: 'center',
                    color: isOpen ? 'var(--mv-bg)' : 'var(--mv-ink-3)',
                    background: isOpen ? 'var(--mv-warm-500)' : 'transparent',
                    transition:
                      'transform .4s var(--mv-ease-expo), background .3s, border-color .3s, color .3s',
                    flexShrink: 0,
                    marginLeft: '20px',
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </button>
              <section
                id={`faq-answer-${index}`}
                aria-labelledby={`faq-question-${index}`}
                style={{
                  maxHeight: isOpen ? '1200px' : '0',
                  overflow: 'hidden',
                  transition: 'max-height .5s var(--mv-ease-expo)',
                }}
              >
                <div
                  style={{
                    padding: '0 0 32px',
                    color: 'var(--mv-ink-2)',
                    fontSize: '16px',
                    lineHeight: 1.6,
                    maxWidth: '680px',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {t(`items.${index}.answer`)}
                </div>
              </section>
            </div>
          );
        })}
      </div>

      {/* Responsive */}
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 820px) {
              .faq-head-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
            }
          `,
        }}
      />
    </section>
  );
}
