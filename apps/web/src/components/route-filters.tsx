'use client';

import type { DiscoverRoutesFilter } from '@motovault/types/validators';
import { useCallback, useState } from 'react';
import { CurvyRoadsPreset } from './curvy-roads-preset';

const SURFACE_OPTIONS = [
  { value: 'paved', label: 'Paved' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'off-road', label: 'Off-road' },
] as const;

const LENGTH_OPTIONS = [
  { value: 'under50', label: '< 50 km' },
  { value: '50to100', label: '50-100 km' },
  { value: '100to200', label: '100-200 km' },
  { value: '200to500', label: '200-500 km' },
  { value: 'over500', label: '500+ km' },
] as const;

const ELEVATION_OPTIONS = [
  { value: 'flat', label: 'Flat' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'mountainous', label: 'Mountainous' },
] as const;

const SURFACE_RECENCY_OPTIONS = [
  { value: undefined, label: 'Any time' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
] as const;

interface RouteFiltersProps {
  filters: Partial<DiscoverRoutesFilter>;
  onChange: (filters: Partial<DiscoverRoutesFilter>) => void;
}

export function RouteFilters({ filters, onChange }: RouteFiltersProps) {
  const [twistScore, setTwistScore] = useState(filters.minTwistScore ?? 1);

  const toggleArrayFilter = useCallback(
    <K extends 'surfaceTypes' | 'lengthRanges' | 'elevationRanges'>(key: K, value: string) => {
      const current = (filters[key] as string[] | undefined) ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange({ ...filters, [key]: next.length > 0 ? next : undefined });
    },
    [filters, onChange],
  );

  const handleTwistScoreChange = useCallback(
    (value: number) => {
      setTwistScore(value);
      onChange({
        ...filters,
        minTwistScore: value > 1 ? value : undefined,
      });
    },
    [filters, onChange],
  );

  const handleCurvyPreset = useCallback(
    (minTwistScore: number | undefined) => {
      const score = minTwistScore ?? 1;
      setTwistScore(score);
      onChange({ ...filters, minTwistScore });
    },
    [filters, onChange],
  );

  const handleSurfaceRecency = useCallback(
    (value: number | undefined) => {
      onChange({ ...filters, surfaceRecency: value });
    },
    [filters, onChange],
  );

  const handleHighlyRated = useCallback(() => {
    onChange({ ...filters, highlyRatedOnly: !filters.highlyRatedOnly || undefined });
  }, [filters, onChange]);

  const activeFilterCount = [
    filters.surfaceTypes?.length ?? 0,
    filters.lengthRanges?.length ?? 0,
    filters.elevationRanges?.length ?? 0,
    filters.highlyRatedOnly ? 1 : 0,
    filters.minTwistScore ? 1 : 0,
    filters.surfaceRecency ? 1 : 0,
  ].reduce((sum, v) => sum + v, 0);

  return (
    <aside className="flex flex-col gap-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-200">Filters</h3>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setTwistScore(1);
              onChange({});
            }}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Quick preset */}
      <CurvyRoadsPreset active={filters.minTwistScore === 7} onToggle={handleCurvyPreset} />

      {/* Twist Score Slider */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="twist-score" className="text-xs font-medium text-neutral-400">
            Min. Twist Score
          </label>
          <span className="text-xs font-mono text-neutral-500">
            {twistScore === 1 ? 'Any' : `${twistScore}/10`}
          </span>
        </div>
        <input
          id="twist-score"
          type="range"
          min={1}
          max={10}
          step={1}
          value={twistScore}
          onChange={(e) => handleTwistScoreChange(Number(e.target.value))}
          className="w-full accent-primary-500"
        />
        <div className="flex justify-between text-[10px] text-neutral-600">
          <span>Straight</span>
          <span>Twisty</span>
          <span>Extreme</span>
        </div>
      </div>

      {/* Surface Type */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-neutral-400">Surface</legend>
        <div className="flex flex-wrap gap-2">
          {SURFACE_OPTIONS.map((opt) => {
            const isActive = filters.surfaceTypes?.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleArrayFilter('surfaceTypes', opt.value)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary-500/50 bg-primary-500/10 text-primary-400'
                    : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Length */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-neutral-400">Distance</legend>
        <div className="flex flex-wrap gap-2">
          {LENGTH_OPTIONS.map((opt) => {
            const isActive = filters.lengthRanges?.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleArrayFilter('lengthRanges', opt.value)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary-500/50 bg-primary-500/10 text-primary-400'
                    : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Elevation */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium text-neutral-400">Elevation</legend>
        <div className="flex flex-wrap gap-2">
          {ELEVATION_OPTIONS.map((opt) => {
            const isActive = filters.elevationRanges?.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleArrayFilter('elevationRanges', opt.value)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary-500/50 bg-primary-500/10 text-primary-400'
                    : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Surface Condition Recency */}
      <div className="flex flex-col gap-2">
        <label htmlFor="surface-recency" className="text-xs font-medium text-neutral-400">
          Surface reports from
        </label>
        <select
          id="surface-recency"
          value={filters.surfaceRecency ?? ''}
          onChange={(e) =>
            handleSurfaceRecency(e.target.value ? Number(e.target.value) : undefined)
          }
          className="rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs text-neutral-300 outline-none transition-colors focus:border-primary-500"
        >
          {SURFACE_RECENCY_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Highly Rated */}
      <button
        type="button"
        onClick={handleHighlyRated}
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          filters.highlyRatedOnly
            ? 'border-warning-500/50 bg-warning-500/10 text-warning-500'
            : 'border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400'
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <title>Star</title>
          <path
            d="M7 1l1.76 3.56L12.5 5.2l-2.75 2.68.65 3.78L7 9.84l-3.4 1.82.65-3.78L1.5 5.2l3.74-.64L7 1z"
            fill={filters.highlyRatedOnly ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
        Highly rated (4.0+)
      </button>
    </aside>
  );
}
