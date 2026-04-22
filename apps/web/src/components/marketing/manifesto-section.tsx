'use client';

import { useEffect, useRef } from 'react';

const WORDS = [
  { id: 'every', text: 'Every', serif: false },
  { id: 'rider', text: 'rider', serif: false },
  { id: 'deserves', text: 'deserves', serif: false },
  { id: 'a', text: 'a', serif: false },
  { id: 'companion', text: 'companion', serif: false },
  { id: 'that', text: 'that', serif: false },
  { id: 'knows', text: 'knows', serif: false },
  { id: 'their', text: 'their', serif: false },
  { id: 'bike', text: 'bike', serif: false },
  { id: 'better', text: 'better', serif: false },
  { id: 'than', text: 'than', serif: false },
  { id: 'the1', text: 'the', serif: false },
  { id: 'shop', text: 'shop', serif: false },
  { id: 'dash', text: '\u2014', serif: false },
  { id: 'and', text: 'and', serif: true },
  { id: 'the2', text: 'the', serif: true },
  { id: 'road', text: 'road', serif: true },
  { id: 'ahead', text: 'ahead.', serif: true },
];

export function ManifestoSection() {
  const quoteRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = quoteRef.current;
    if (!el) return;

    const words = el.querySelectorAll<HTMLSpanElement>('span[data-word]');

    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.max(0, Math.min(1, (vh * 0.7 - rect.top) / (rect.height + vh * 0.3)));
      const onCount = Math.floor(progress * words.length);
      for (let i = 0; i < words.length; i++) {
        words[i].style.color =
          i < onCount
            ? words[i].dataset.serif === 'true'
              ? 'var(--mv-warm-400)'
              : 'var(--mv-ink)'
            : 'var(--mv-ink-4)';
      }
    };

    window.addEventListener('scroll', update, { passive: true });
    update();

    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <section
      style={{
        padding: '200px 40px',
        maxWidth: 'var(--mv-container)',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-geist-mono, 'Geist Mono', monospace)",
          fontSize: '11px',
          color: 'var(--mv-warm-400)',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}
      >
        Our promise
      </div>
      <p
        ref={quoteRef}
        style={{
          fontSize: 'clamp(36px, 5vw, 72px)',
          fontWeight: 400,
          lineHeight: 1.1,
          letterSpacing: '-0.035em',
          margin: '32px 0 0',
          maxWidth: '1000px',
        }}
      >
        {WORDS.map((w) => (
          <span
            key={w.id}
            data-word=""
            data-serif={w.serif ? 'true' : 'false'}
            style={{
              color: 'var(--mv-ink-4)',
              transition: 'color .08s linear',
              ...(w.serif
                ? {
                    fontFamily: "var(--font-instrument-serif, 'Instrument Serif', serif)",
                    fontStyle: 'italic',
                  }
                : {}),
            }}
          >
            {w.text}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}
