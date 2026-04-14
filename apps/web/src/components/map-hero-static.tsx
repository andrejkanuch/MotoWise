'use client';

import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Difficulty derivation from curvature + elevation                  */
/* ------------------------------------------------------------------ */

const DIFFICULTY_LEVELS = {
  easy: { label: 'Easy', gradient: 'from-accent-600/80 to-accent-500/40' },
  moderate: { label: 'Moderate', gradient: 'from-primary-700/80 to-primary-500/40' },
  hard: { label: 'Hard', gradient: 'from-signature-600/80 to-signature-400/40' },
  expert: { label: 'Expert', gradient: 'from-danger-500/80 to-danger-500/30' },
} as const;

type DifficultyKey = keyof typeof DIFFICULTY_LEVELS;

function deriveDifficulty(curvatureIndex?: number, elevationGainM?: number): DifficultyKey {
  const c = curvatureIndex ?? 0;
  const e = elevationGainM ?? 0;

  if (c >= 40 || e >= 1500) return 'expert';
  if (c >= 25 || e >= 800) return 'hard';
  if (c >= 12 || e >= 300) return 'moderate';
  return 'easy';
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface MapHeroStaticRoute {
  id: string;
  polyline: string;
  startLat?: number;
  startLng?: number;
  distanceM: number;
  elevationGainM?: number;
  curvatureIndex?: number;
  surfaceType?: string;
}

interface MapHeroStaticProps {
  route: MapHeroStaticRoute;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MapHeroStatic({ route }: MapHeroStaticProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const difficulty = deriveDifficulty(route.curvatureIndex, route.elevationGainM);
  const difficultyMeta = DIFFICULTY_LEVELS[difficulty];
  const distanceKm = (route.distanceM / 1000).toFixed(1);
  const heroSrc = `/api/route-hero/${route.id}`;

  return (
    <section
      className="relative w-full overflow-hidden bg-primary-950"
      /* 16:8 (2:1) aspect ratio — prevents layout shift */
      style={{ aspectRatio: '2 / 1' }}
    >
      {/* Skeleton loader */}
      {!loaded && !error && <div className="absolute inset-0 animate-pulse bg-primary-900/60" />}

      {/* Hero image */}
      {!error ? (
        /* biome-ignore lint/performance/noImgElement: dynamic proxied URL from route-hero API */
        <img
          src={heroSrc}
          alt="Route map overview"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="eager"
          fetchPriority="high"
        />
      ) : (
        /* Branded fallback — gradient placeholder */
        <div className="absolute inset-0 bg-gradient-to-br from-primary-950 via-primary-800 to-primary-600" />
      )}

      {/* Difficulty-coded gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${difficultyMeta.gradient}`} />

      {/* Bottom fade for readability */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-primary-950/90 to-transparent" />

      {/* Route stats overlay */}
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-4">
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Distance */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
              <DistanceIcon />
              {distanceKm} km
            </span>

            {/* Elevation */}
            {route.elevationGainM != null && route.elevationGainM > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
                <ElevationIcon />
                {Math.round(route.elevationGainM)} m
              </span>
            )}

            {/* Surface */}
            {route.surfaceType && route.surfaceType !== 'unknown' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm">
                {route.surfaceType}
              </span>
            )}

            {/* Difficulty badge */}
            <DifficultyBadge difficulty={difficulty} label={difficultyMeta.label} />
          </div>

          {/* CTA */}
          <a
            href="/signup"
            className="hidden shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:inline-flex"
          >
            <MapPinIcon />
            Sign up to explore
          </a>
        </div>

        {/* Mobile CTA */}
        <a
          href="/signup"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-primary-900 shadow-lg sm:hidden"
        >
          <MapPinIcon />
          Sign up to explore interactively
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

const BADGE_COLORS: Record<DifficultyKey, string> = {
  easy: 'bg-accent-500/20 text-accent-400 ring-accent-400/30',
  moderate: 'bg-primary-400/20 text-primary-300 ring-primary-400/30',
  hard: 'bg-signature-500/20 text-signature-400 ring-signature-400/30',
  expert: 'bg-danger-500/20 text-danger-500 ring-danger-500/30',
};

function DifficultyBadge({ difficulty, label }: { difficulty: DifficultyKey; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ring-inset backdrop-blur-sm ${BADGE_COLORS[difficulty]}`}
    >
      {label}
    </span>
  );
}

/* Inline SVG icons — avoids extra dependency for 3 icons */

function DistanceIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ElevationIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
