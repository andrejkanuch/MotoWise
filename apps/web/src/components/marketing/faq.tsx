'use client';

import { useState } from 'react';

const FAQ_ITEMS = [
  {
    question: 'What is MotoVault?',
    answer:
      'A free iOS and Android app that brings together the four things every rider needs: multi-day trip planning, maintenance tracking, expenses, and AI photo diagnostics. No OBD hardware. No subscription to start.',
  },
  {
    question: 'Is it really free?',
    answer:
      'Yes. The core app \u2014 maintenance, expenses, rides, garage, trip planner \u2014 is free forever for unlimited bikes. MotoVault Pro ($4/month) unlocks advanced AI scans, rider analytics and higher GPX export limits.',
  },
  {
    question: 'How does AI diagnostics work?',
    answer:
      'Open the camera, frame the part or warning light, and tap. A vision model identifies what it\u2019s looking at, cross-references failure modes for your specific bike, and returns a diagnosis with a recommended next step \u2014 usually in under five seconds.',
  },
  {
    question: 'What bikes does it support?',
    answer:
      'Every major make and model from the last 30 years. Specs load automatically for over 12,000 models \u2014 from Honda Groms to BMW R 1250 GS \u2014 and you can add custom bikes too.',
  },
  {
    question: 'Is my data safe?',
    answer:
      'Ride data, GPS traces and bike details are encrypted in transit and at rest. Export or delete your full history at any time \u2014 one tap, in settings.',
  },
];

export function Faq() {
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
          <div className="mv-section-meta">FAQ &middot; 02</div>
          <h2 className="mv-section-title">
            Questions, <span className="mv-serif mv-muted">answered.</span>
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
          Everything you&apos;d ask in the first five minutes. If we missed yours,{' '}
          <a
            href="mailto:support@motovault.app"
            style={{ color: 'var(--mv-warm-400)', textDecoration: 'none' }}
          >
            write to us
          </a>
          .
        </p>
      </div>

      {/* Accordion */}
      <div style={{ marginTop: '64px', borderTop: '1px solid var(--mv-line)' }}>
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question} style={{ borderBottom: '1px solid var(--mv-line)' }}>
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
                aria-expanded={isOpen}
              >
                {item.question}
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: isOpen ? '1px solid var(--mv-warm-500)' : '1px solid var(--mv-line)',
                    display: 'grid',
                    placeItems: 'center',
                    color: isOpen ? 'oklch(0.15 0.02 55)' : 'var(--mv-ink-3)',
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
              <div
                style={{
                  maxHeight: isOpen ? '400px' : '0',
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
                  {item.answer}
                </div>
              </div>
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
