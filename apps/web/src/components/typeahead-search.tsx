'use client';

import type { SearchTypeaheadQuery } from '@motovault/graphql';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ── Types ────────────────────────────────────────────────────── */

type RouteSuggestion = SearchTypeaheadQuery['searchTypeahead']['routes'][number];
type PlaceSuggestion = SearchTypeaheadQuery['searchTypeahead']['places'][number];

type TypeaheadData = SearchTypeaheadQuery['searchTypeahead'];

/* ── Constants ────────────────────────────────────────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

const TYPEAHEAD_QUERY = `
  query SearchTypeahead($q: String, $limit: Int) {
    searchTypeahead(q: $q, limit: $limit) {
      routes { id name slug countryCode regionCode }
      places { id name kind countryCode regionCode population }
    }
  }
`;

/* ── Helpers ──────────────────────────────────────────────────── */

async function fetchTypeahead(q: string): Promise<TypeaheadData> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: TYPEAHEAD_QUERY, variables: { q, limit: 8 } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data?.searchTypeahead ?? { routes: [], places: [] };
}

function buildRouteHref(r: RouteSuggestion): string {
  const country = r.countryCode.toLowerCase();
  const region = (r.regionCode ?? '').toLowerCase();
  return `/route/${country}/${region}/${r.slug}`;
}

function buildPlaceHref(p: PlaceSuggestion): string {
  return `/explore/${p.countryCode.toLowerCase()}`;
}

/* ── Icon components ─────────────────────────────────────────── */

const ICON_CLASS = 'h-4 w-4 shrink-0 text-neutral-500';

function GlobeIcon() {
  return (
    <svg
      className={ICON_CLASS}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      className={ICON_CLASS}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      className={ICON_CLASS}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21"
      />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg
      className={ICON_CLASS}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
      />
    </svg>
  );
}

function KindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'country':
      return <GlobeIcon />;
    case 'region':
      return <PinIcon />;
    default:
      return <BuildingIcon />;
  }
}

/* ── Component ────────────────────────────────────────────────── */

export function TypeaheadSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<TypeaheadData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Flatten results for keyboard navigation
  const allItems = useMemo(() => {
    const items: Array<
      { type: 'place'; item: PlaceSuggestion } | { type: 'route'; item: RouteSuggestion }
    > = [];
    if (data) {
      for (const p of data.places) items.push({ type: 'place', item: p });
      for (const r of data.routes) items.push({ type: 'route', item: r });
    }
    return items;
  }, [data]);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setData(null);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await fetchTypeahead(query.trim());
        setData(result);
        setIsOpen(result.routes.length > 0 || result.places.length > 0);
        setActiveIndex(-1);
      } catch {
        setData(null);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setIsOpen(false);
      setQuery('');
      router.push(href);
    },
    [router],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || allItems.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : allItems.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < allItems.length) {
            const selected = allItems[activeIndex];
            if (selected.type === 'route') {
              navigate(buildRouteHref(selected.item));
            } else {
              navigate(buildPlaceHref(selected.item));
            }
          }
          break;
        case 'Escape':
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, allItems, activeIndex, navigate],
  );

  const placesCount = data?.places.length ?? 0;

  return (
    <div ref={containerRef} className="relative mx-auto max-w-2xl">
      <div className="relative">
        {/* Search icon */}
        <svg
          className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>

        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (data && (data.routes.length > 0 || data.places.length > 0)) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by country, region, or route name..."
          className="w-full rounded-2xl border border-neutral-700/50 bg-neutral-900/80 py-4 pl-13 pr-14 text-base text-neutral-50 placeholder:text-neutral-500 backdrop-blur-xl focus:border-primary-500/50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
          aria-label="Search motorcycle routes"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="typeahead-listbox"
          aria-activedescendant={activeIndex >= 0 ? `typeahead-item-${activeIndex}` : undefined}
          autoComplete="off"
        />

        {/* Loading spinner */}
        {isLoading && (
          <output
            className="absolute right-5 top-1/2 -translate-y-1/2"
            aria-label="Loading search results"
          >
            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-neutral-600 border-t-primary-400" />
          </output>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && allItems.length > 0 && (
        <div
          id="typeahead-listbox"
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-neutral-700/50 bg-neutral-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          {/* Places section */}
          {data && data.places.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Locations
              </div>
              {data.places.map((place, i) => (
                <button
                  key={`place-${place.id}`}
                  id={`typeahead-item-${i}`}
                  role="option"
                  type="button"
                  aria-selected={activeIndex === i}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    activeIndex === i
                      ? 'bg-primary-500/10 text-neutral-50'
                      : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-neutral-50'
                  }`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => navigate(buildPlaceHref(place))}
                >
                  <KindIcon kind={place.kind} />
                  <span className="truncate font-medium">{place.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-neutral-600 capitalize">
                    {place.kind}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Routes section */}
          {data && data.routes.length > 0 && (
            <div>
              {placesCount > 0 && <div className="mx-4 border-t border-neutral-800" />}
              <div className="px-4 pt-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Routes
              </div>
              {data.routes.map((route, i) => {
                const idx = placesCount + i;
                return (
                  <button
                    key={`route-${route.id}`}
                    id={`typeahead-item-${idx}`}
                    role="option"
                    type="button"
                    aria-selected={activeIndex === idx}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      activeIndex === idx
                        ? 'bg-primary-500/10 text-neutral-50'
                        : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-neutral-50'
                    }`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(buildRouteHref(route))}
                  >
                    <MapIcon />
                    <span className="truncate font-medium">{route.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-neutral-600 uppercase">
                      {route.countryCode}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          <div className="border-t border-neutral-800 px-4 py-2 text-xs text-neutral-600">
            <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-500">
              &uarr;&darr;
            </kbd>{' '}
            to navigate{' '}
            <kbd className="ml-1 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-500">
              Enter
            </kbd>{' '}
            to select{' '}
            <kbd className="ml-1 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-500">
              Esc
            </kbd>{' '}
            to close
          </div>
        </div>
      )}
    </div>
  );
}
