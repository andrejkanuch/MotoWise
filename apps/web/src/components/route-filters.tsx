'use client';

import { DIFFICULTY_LEVELS, type RouteFilters, SURFACE_TYPES } from '@motovault/types';
import { useCallback, useMemo } from 'react';

const DIFFICULTY_OPTIONS = [
  { value: DIFFICULTY_LEVELS.EASY, label: 'Easy' },
  { value: DIFFICULTY_LEVELS.MODERATE, label: 'Moderate' },
  { value: DIFFICULTY_LEVELS.HARD, label: 'Hard' },
  { value: DIFFICULTY_LEVELS.EXPERT, label: 'Expert' },
] as const;

const SURFACE_OPTIONS = [
  { value: SURFACE_TYPES.PAVED, label: 'Paved' },
  { value: SURFACE_TYPES.MIXED, label: 'Mixed' },
  { value: SURFACE_TYPES.OFF_ROAD, label: 'Off-road' },
] as const;

type RouteFiltersSidebarProps = {
  filters: RouteFilters;
  onChangeFilters: (filters: RouteFilters) => void;
};

export function RouteFiltersSidebar({ filters, onChangeFilters }: RouteFiltersSidebarProps) {
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minKm != null && filters.minKm > 0) count++;
    if (filters.maxKm != null) count++;
    if (filters.minElevationM != null && filters.minElevationM > 0) count++;
    if (filters.maxElevationM != null) count++;
    if (filters.difficulty?.length) count++;
    if (filters.surface?.length) count++;
    return count;
  }, [filters]);

  const handleClearAll = useCallback(() => {
    onChangeFilters({});
  }, [onChangeFilters]);

  const update = useCallback(
    (patch: Partial<RouteFilters>) => {
      onChangeFilters({ ...filters, ...patch });
    },
    [filters, onChangeFilters],
  );

  const toggleDifficulty = useCallback(
    (value: (typeof DIFFICULTY_LEVELS)[keyof typeof DIFFICULTY_LEVELS]) => {
      const current = filters.difficulty ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      update({ difficulty: next.length > 0 ? next : undefined });
    },
    [filters.difficulty, update],
  );

  const toggleSurface = useCallback(
    (value: (typeof SURFACE_TYPES)[keyof typeof SURFACE_TYPES]) => {
      const current = filters.surface ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      update({ surface: next.length > 0 ? next : undefined });
    },
    [filters.surface, update],
  );

  return (
    <aside className="sticky top-0 flex h-fit w-72 shrink-0 flex-col gap-6 rounded-xl border border-neutral-800 bg-neutral-950 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-50">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-medium text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Length range */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Length (km)
        </legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-min-km">
            Minimum km
          </label>
          <input
            id="filter-min-km"
            type="number"
            min={0}
            max={500}
            placeholder="0"
            value={filters.minKm ?? ''}
            onChange={(e) =>
              update({
                minKm: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-xs text-neutral-500">to</span>
          <label className="sr-only" htmlFor="filter-max-km">
            Maximum km
          </label>
          <input
            id="filter-max-km"
            type="number"
            min={0}
            max={500}
            placeholder="500"
            value={filters.maxKm ?? ''}
            onChange={(e) =>
              update({
                maxKm: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </fieldset>

      {/* Elevation range */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Elevation gain (m)
        </legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-min-elevation">
            Minimum elevation
          </label>
          <input
            id="filter-min-elevation"
            type="number"
            min={0}
            max={5000}
            placeholder="0"
            value={filters.minElevationM ?? ''}
            onChange={(e) =>
              update({
                minElevationM: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-xs text-neutral-500">to</span>
          <label className="sr-only" htmlFor="filter-max-elevation">
            Maximum elevation
          </label>
          <input
            id="filter-max-elevation"
            type="number"
            min={0}
            max={5000}
            placeholder="5000"
            value={filters.maxElevationM ?? ''}
            onChange={(e) =>
              update({
                maxElevationM: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </fieldset>

      {/* Difficulty chips */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Difficulty
        </legend>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_OPTIONS.map((opt) => {
            const selected = filters.difficulty?.includes(opt.value) ?? false;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleDifficulty(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-neutral-950 ${
                  selected
                    ? 'bg-primary-600 text-white'
                    : 'border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Surface chips */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          Surface
        </legend>
        <div className="flex flex-wrap gap-2">
          {SURFACE_OPTIONS.map((opt) => {
            const selected = filters.surface?.includes(opt.value) ?? false;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSurface(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-neutral-950 ${
                  selected
                    ? 'bg-primary-600 text-white'
                    : 'border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </aside>
  );
}
