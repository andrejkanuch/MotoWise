'use client';

import { useEffect, useRef } from 'react';
import { gsap } from './motion';

interface ProofStatProps {
  value: string;
  suffix?: string;
  label: string;
}

/** A single proof stat: numeric values count up from zero on first view and a
 *  copper underline draws in. Server-rendered with the final value, so crawlers
 *  and no-JS users always see the real number. */
export function ProofStat({ value, suffix, label }: ProofStatProps) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const valueEl = valueRef.current;
    if (!root || !valueEl) return;

    const numeric = Number.parseFloat(value);
    const isNumeric = Number.isFinite(numeric) && /^[\d.,]+$/.test(value.trim());
    const decimals = isNumeric && /[.,]\d+$/.test(value.trim()) ? 1 : 0;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root, start: 'top 85%', once: true },
      });

      if (isNumeric) {
        const counter = { v: 0 };
        valueEl.textContent = (0).toFixed(decimals);
        tl.to(counter, {
          v: numeric,
          duration: 1.6,
          ease: 'power3.out',
          onUpdate: () => {
            valueEl.textContent = counter.v.toFixed(decimals);
          },
          onComplete: () => {
            valueEl.textContent = value;
          },
        });
      }
      if (lineRef.current) {
        tl.fromTo(
          lineRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 1.1, ease: 'expo.out' },
          isNumeric ? 0.25 : 0,
        );
      }
      return () => {
        tl.scrollTrigger?.kill();
        tl.kill();
        valueEl.textContent = value;
        if (lineRef.current) gsap.set(lineRef.current, { scaleX: 1 });
      };
    });

    return () => mm.revert();
  }, [value]);

  return (
    <div ref={rootRef} style={{ borderLeft: '1px solid var(--mv-line)', paddingLeft: '24px' }}>
      <div
        style={{
          fontSize: 'clamp(40px, 4.5vw, 68px)',
          fontWeight: 500,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--mv-ink)',
        }}
      >
        <span ref={valueRef}>{value}</span>
        {suffix && (
          <span style={{ fontSize: '0.5em', fontWeight: 400, color: 'var(--mv-ink-2)' }}>
            {suffix}
          </span>
        )}
      </div>
      <span
        ref={lineRef}
        aria-hidden="true"
        style={{
          display: 'block',
          width: '40px',
          height: '2px',
          marginTop: '16px',
          background: 'var(--mv-warm-500)',
          transformOrigin: 'left center',
        }}
      />
      <div
        style={{
          marginTop: '12px',
          color: 'var(--mv-ink-3)',
          fontSize: '13px',
          letterSpacing: '-0.005em',
        }}
      >
        {label}
      </div>
    </div>
  );
}
