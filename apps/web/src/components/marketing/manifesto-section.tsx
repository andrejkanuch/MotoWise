'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollTrigger } from './motion';

export function ManifestoSection() {
  const t = useTranslations('Manifesto');
  const quoteRef = useRef<HTMLParagraphElement>(null);

  const words = useMemo(() => {
    const lead = t('lead')
      .split(/\s+/)
      .filter(Boolean)
      .map((text, i) => ({ id: `lead-${i}`, text, serif: false }));
    const emphasis = t('emphasis')
      .split(/\s+/)
      .filter(Boolean)
      .map((text, i) => ({ id: `emphasis-${i}`, text, serif: true }));
    return [...lead, ...emphasis];
  }, [t]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `words` is the trigger — when the translated word list changes (e.g. locale switch) the spans re-render and the ScrollTrigger must re-bind to the new elements.
  useEffect(() => {
    const el = quoteRef.current;
    if (!el) return;

    const wordEls = el.querySelectorAll<HTMLSpanElement>('span[data-word]');

    const paint = (progress: number) => {
      const onCount = Math.floor(progress * wordEls.length);
      for (let i = 0; i < wordEls.length; i++) {
        wordEls[i].style.color =
          i < onCount
            ? wordEls[i].dataset.serif === 'true'
              ? 'var(--mv-warm-400)'
              : 'var(--mv-ink)'
            : 'var(--mv-ink-4)';
      }
    };

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 72%',
      end: 'bottom 45%',
      scrub: true,
      onUpdate: (self) => paint(self.progress),
    });
    paint(st.progress);

    return () => st.kill();
  }, [words]);

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
        {t('eyebrow')}
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
        {words.map((w) => (
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
