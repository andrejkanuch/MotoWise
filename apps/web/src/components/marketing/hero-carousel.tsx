'use client';

import { useEffect, useReducer } from 'react';

const IMAGES = [
  '/images/propagation-images/motovault-home-1284x2778.png',
  '/images/propagation-images/motovault-learn-1284x2778.png',
  '/images/propagation-images/motovault-diagnose-1284x2778.png',
  '/images/propagation-images/motovault-garage-1284x2778.png',
  '/images/propagation-images/motovault-expense-1284x2778.png',
  '/images/propagation-images/motovault-edit-1284x2778.png',
] as const;

const INTERVAL_MS = 4000;

export function HeroCarousel() {
  const [active, next] = useReducer((i: number) => (i + 1) % IMAGES.length, 0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;

    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative">
      {IMAGES.map((src, i) => (
        // biome-ignore lint/performance/noImgElement: decorative marketing images
        <img
          key={src}
          src={src}
          alt=""
          className="block w-full transition-opacity duration-700 ease-in-out"
          style={{
            position: i === 0 ? 'relative' : 'absolute',
            inset: i === 0 ? undefined : 0,
            opacity: i === active ? 1 : 0,
          }}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {IMAGES.map((src, i) => (
          <span
            key={src}
            className="block h-1 rounded-full transition-all duration-500"
            style={{
              width: i === active ? 16 : 4,
              backgroundColor: i === active ? 'oklch(0.85 0.15 55)' : 'oklch(0.5 0 0 / 0.5)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
