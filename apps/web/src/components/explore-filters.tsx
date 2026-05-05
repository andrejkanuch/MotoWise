'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';

/* ── Filter definitions ──────────────────────────────────────── */

const FILTER_GROUPS = [
  {
    key: 'difficulty',
    label: 'Difficulty',
    options: [
      { value: 'easy', label: 'Easy' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'challenging', label: 'Challenging' },
      { value: 'expert', label: 'Expert' },
    ],
  },
  {
    key: 'surface',
    label: 'Surface',
    options: [
      { value: 'paved', label: 'Paved' },
      { value: 'mixed', label: 'Mixed' },
      { value: 'off-road', label: 'Off-road' },
    ],
  },
  {
    key: 'distance',
    label: 'Distance',
    options: [
      { value: 'under-50km', label: '< 50 km' },
      { value: '50-100km', label: '50-100 km' },
      { value: '100-300km', label: '100-300 km' },
      { value: '300km+', label: '300+ km' },
    ],
  },
  {
    key: 'sort',
    label: 'Sort',
    options: [
      { value: 'rating', label: 'Rating' },
      { value: 'distance', label: 'Distance' },
      { value: 'newest', label: 'Newest' },
    ],
  },
] as const;

/* ── Styles ──────────────────────────────────────────────────── */

const pillBase: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 999,
  border: '1px solid var(--mv-line)',
  fontSize: 12,
  fontFamily: 'var(--font-geist-mono, monospace)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  transition: 'all 0.2s',
  background: 'var(--mv-surface)',
  color: 'var(--mv-ink-2)',
};

const pillActive: React.CSSProperties = {
  ...pillBase,
  background: 'var(--mv-warm-500)',
  color: '#000',
  borderColor: 'var(--mv-warm-500)',
};

const categoryPillBase: React.CSSProperties = {
  ...pillBase,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

/* ── Component ───────────────────────────────────────────────── */

export function ExploreFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const getActiveValue = useCallback(
    (key: string): string | null => {
      return searchParams.get(key);
    },
    [searchParams],
  );

  const toggleFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get(key) === value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/explore?${params.toString()}`, { scroll: false });
    },
    [searchParams, router],
  );

  const toggleGroup = useCallback((key: string) => {
    setOpenGroup((prev) => (prev === key ? null : key));
  }, []);

  const activeCount = FILTER_GROUPS.reduce(
    (count, group) => count + (searchParams.has(group.key) ? 1 : 0),
    0,
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const group of FILTER_GROUPS) {
      params.delete(group.key);
    }
    router.push(`/explore?${params.toString()}`, { scroll: false });
    setOpenGroup(null);
  }, [searchParams, router]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '24px 0 0',
      }}
    >
      {/* Category pills row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            color: 'var(--mv-ink-3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginRight: 4,
            whiteSpace: 'nowrap',
          }}
        >
          Filters:
        </span>

        {FILTER_GROUPS.map((group) => {
          const activeValue = getActiveValue(group.key);
          const isOpen = openGroup === group.key;
          const activeOption = activeValue
            ? group.options.find((o) => o.value === activeValue)
            : null;

          return (
            <button
              key={group.key}
              type="button"
              onClick={() => toggleGroup(group.key)}
              style={{
                ...categoryPillBase,
                ...(activeOption
                  ? {
                      background: 'var(--mv-warm-500)',
                      color: '#000',
                      borderColor: 'var(--mv-warm-500)',
                    }
                  : {}),
                ...(isOpen && !activeOption ? { borderColor: 'var(--mv-ink-2)' } : {}),
              }}
            >
              {activeOption ? activeOption.label : group.label}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: 'transform 0.2s',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                }}
              >
                <title>Toggle</title>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          );
        })}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              ...pillBase,
              fontSize: 11,
              padding: '6px 12px',
              color: 'var(--mv-ink-3)',
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expanded filter options */}
      {openGroup && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            paddingLeft: 2,
          }}
        >
          {FILTER_GROUPS.find((g) => g.key === openGroup)?.options.map((option) => {
            const isActive = getActiveValue(openGroup) === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleFilter(openGroup, option.value)}
                style={isActive ? pillActive : pillBase}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
