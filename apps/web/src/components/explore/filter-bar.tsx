'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './primitives';

/* ── Dropdown pill ───────────────────────────────────────────── */

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = !!value;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayValue = value ? (options.find((o) => o.value === value)?.label ?? value) : 'Any';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 14px',
          borderRadius: 999,
          background: active ? 'oklch(0.84 0.15 68 / 0.13)' : 'oklch(1 0 0 / 0.03)',
          border: `1px solid ${active ? 'oklch(0.84 0.15 68 / 0.5)' : 'var(--mv-line)'}`,
          color: active ? 'var(--mv-warm-300)' : 'var(--mv-ink-2)',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 500,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: active ? 0.8 : 0.6,
          }}
        >
          {label}
        </span>
        <span style={{ fontWeight: 500 }}>{displayValue}</span>
        <span
          style={{
            display: 'inline-flex',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        >
          <Icon name="chevron-down" size={11} />
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 160,
            background: 'oklch(0.14 0.01 55)',
            border: '1px solid var(--mv-line)',
            borderRadius: 12,
            padding: 4,
            zIndex: 50,
            boxShadow: '0 8px 24px -6px oklch(0 0 0 / 0.5)',
          }}
        >
          {/* "Any" option */}
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              background: !value ? 'oklch(0.84 0.15 68 / 0.1)' : 'transparent',
              border: 'none',
              color: !value ? 'var(--mv-warm-300)' : 'var(--mv-ink-2)',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Any
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                background: value === opt.value ? 'oklch(0.84 0.15 68 / 0.1)' : 'transparent',
                border: 'none',
                color: value === opt.value ? 'var(--mv-warm-300)' : 'var(--mv-ink-2)',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sort pill (simple cycle — no dropdown needed) ────────────── */

function SortPill({ value, onClick }: { value: string; onClick: () => void }) {
  const label = value === 'distance' ? 'Distance' : value === 'newest' ? 'Newest' : 'Rating';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 999,
        background: 'oklch(0.84 0.15 68 / 0.13)',
        border: '1px solid oklch(0.84 0.15 68 / 0.5)',
        color: 'var(--mv-warm-300)',
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-geist-mono, monospace)',
          fontSize: 9.5,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity: 0.8,
        }}
      >
        Sort
      </span>
      <span style={{ fontWeight: 500 }}>{label}</span>
      <Icon name="chevron-down" size={11} />
    </button>
  );
}

/* ── Filter bar ──────────────────────────────────────────────── */

const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'challenging', label: 'Hard' },
  { value: 'expert', label: 'Expert' },
];

const SURFACES = [
  { value: 'paved', label: 'Paved' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'off-road', label: 'Off-Road' },
];

export interface FilterState {
  difficulty: string;
  surface: string;
  sort: string;
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export function FilterBar({ filters, onFilterChange }: FilterBarProps) {
  const hasActive = filters.difficulty || filters.surface;

  const set = useCallback(
    (key: keyof FilterState, value: string) => {
      onFilterChange({ ...filters, [key]: value });
    },
    [filters, onFilterChange],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 28px',
        background: 'var(--mv-bg-2, oklch(0.10 0.009 55))',
        borderBottom: '1px solid var(--mv-line)',
        position: 'relative',
        zIndex: 20,
      }}
    >
      <Icon name="sliders" size={14} color="var(--mv-ink-3)" />
      <FilterDropdown
        label="Difficulty"
        value={filters.difficulty}
        options={DIFFICULTIES}
        onChange={(v) => set('difficulty', v)}
      />
      <FilterDropdown
        label="Surface"
        value={filters.surface}
        options={SURFACES}
        onChange={(v) => set('surface', v)}
      />
      <span style={{ width: 1, height: 22, background: 'var(--mv-line)', margin: '0 4px' }} />
      <SortPill
        value={filters.sort}
        onClick={() => {
          const next =
            filters.sort === 'rating'
              ? 'distance'
              : filters.sort === 'distance'
                ? 'newest'
                : 'rating';
          set('sort', next);
        }}
      />
      <span style={{ flex: 1 }} />
      {hasActive && (
        <button
          type="button"
          onClick={() => onFilterChange({ difficulty: '', surface: '', sort: filters.sort })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid var(--mv-line)',
            color: 'var(--mv-ink-3)',
            fontFamily: 'inherit',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <Icon name="close" size={11} /> Clear all
        </button>
      )}
    </div>
  );
}
