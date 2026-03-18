'use client';

import Image from 'next/image';
import { useEffect, useReducer } from 'react';

const IMAGES = [
  {
    src: '/images/propagation-images/motovault-home-1284x2778.png',
    alt: 'MotoVault app home screen showing motorcycle garage dashboard',
  },
  {
    src: '/images/propagation-images/motovault-learn-1284x2778.png',
    alt: 'MotoVault learning paths with motorcycle maintenance courses',
  },
  {
    src: '/images/propagation-images/motovault-diagnose-1284x2778.png',
    alt: 'MotoVault AI diagnostics analyzing a motorcycle issue',
  },
  {
    src: '/images/propagation-images/motovault-garage-1284x2778.png',
    alt: 'MotoVault digital garage with motorcycle details and service history',
  },
  {
    src: '/images/propagation-images/motovault-expense-1284x2778.png',
    alt: 'MotoVault expense tracker showing motorcycle ownership costs',
  },
  {
    src: '/images/propagation-images/motovault-edit-1284x2778.png',
    alt: 'MotoVault bike editor for updating motorcycle information',
  },
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
    <div className="relative" style={{ aspectRatio: '1284/2778' }}>
      {IMAGES.map((image, i) => (
        <Image
          key={image.src}
          src={image.src}
          alt={image.alt}
          width={1284}
          height={2778}
          className="block w-full bg-neutral-900 transition-opacity duration-700 ease-in-out"
          style={{
            position: i === 0 ? 'relative' : 'absolute',
            inset: i === 0 ? undefined : 0,
            opacity: i === active ? 1 : 0,
          }}
          priority={i === 0}
          fetchPriority={i === 0 ? 'high' : 'low'}
          loading={i === 0 ? 'eager' : 'lazy'}
          sizes="(max-width: 768px) 100vw, 45vw"
        />
      ))}

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {IMAGES.map((image, i) => (
          <span
            key={image.src}
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
