'use client';

import { useCallback } from 'react';

/* ── Options ─────────────────────────────────────────────────── */

const ANY = { value: '', label: 'Any' } as const;

const DIFFICULTIES = [
  ANY,
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'challenging', label: 'Hard' },
  { value: 'expert', label: 'Expert' },
] as const;

const SURFACES = [
  ANY,
  { value: 'paved', label: 'Paved' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'off-road', label: 'Off-road' },
] as const;

const SORTS = [
  { value: 'rating', label: 'Rating' },
  { value: 'distance', label: 'Distance' },
  { value: 'newest', label: 'Newest' },
] as const;

export interface FilterState {
  difficulty: string;
  surface: string;
  sort: string;
}

export const DEFAULT_FILTERS: FilterState = { difficulty: '', surface: '', sort: 'rating' };

const GROUPS: ReadonlyArray<{
  key: keyof FilterState;
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}> = [
  { key: 'difficulty', label: 'Difficulty', options: DIFFICULTIES },
  { key: 'surface', label: 'Surface', options: SURFACES },
  { key: 'sort', label: 'Sort by', options: SORTS },
];

/* ── Segmented control ───────────────────────────────────────── */

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="xp-filter-group">
      <legend className="xp-label">{label}</legend>
      <div className="mv-segmented">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/* ── Filter bar ──────────────────────────────────────────────── */

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const hasActive = Boolean(filters.difficulty || filters.surface);

  const set = useCallback(
    (key: keyof FilterState, value: string) => {
      onFilterChange({ ...filters, [key]: value });
    },
    [filters, onFilterChange],
  );

  return (
    <div className="xp-filters mv-scroll-row">
      {GROUPS.map((g) => (
        <Segmented
          key={g.key}
          label={g.label}
          value={filters[g.key]}
          options={g.options}
          onChange={(v) => set(g.key, v)}
        />
      ))}
      {hasActive && (
        <button
          type="button"
          className="mv-link is-quiet is-tall"
          onClick={() => onFilterChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
