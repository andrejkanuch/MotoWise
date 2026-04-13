'use client';

import { useCallback } from 'react';

const CURVY_TWIST_SCORE = 7;

interface CurvyRoadsPresetProps {
  active: boolean;
  onToggle: (minTwistScore: number | undefined) => void;
}

export function CurvyRoadsPreset({ active, onToggle }: CurvyRoadsPresetProps) {
  const handleToggle = useCallback(() => {
    onToggle(active ? undefined : CURVY_TWIST_SCORE);
  }, [active, onToggle]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary-500 bg-primary-500/10 text-primary-400'
          : 'border-neutral-700 bg-neutral-800/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
      }`}
      aria-pressed={active}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className={active ? 'text-primary-400' : 'text-neutral-500'}
      >
        <title>Curvy road</title>
        <path
          d="M2 14C2 14 4 10 5.5 8C7 6 6 4 8 2C10 4 9 6 10.5 8C12 10 14 14 14 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Curvy roads only
    </button>
  );
}
