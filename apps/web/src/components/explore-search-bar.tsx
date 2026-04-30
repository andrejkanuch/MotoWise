'use client';

import type { SearchTypeaheadQuery } from '@motovault/graphql';
import { useRouter, useSearchParams } from 'next/navigation';
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

const FILTER_CHIPS = [
  { label: 'Mountain passes', query: 'Pass' },
  { label: 'Coastal', query: 'Coast' },
  { label: 'Weekend escape', query: 'Loop' },
  { label: 'Adventure', query: 'Trail' },
  { label: 'Dolomites', query: 'Dolomites' },
  { label: 'Scotland', query: 'Scotland' },
  { label: 'Pyrenees', query: 'Pyrenees' },
  { label: 'Big Sur', query: 'Big Sur' },
] as const;

const FALLBACK_COUNTRIES = [
  { code: 'IT', label: 'Italy' },
  { code: 'ES', label: 'Spain' },
  { code: 'AT', label: 'Austria' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'US', label: 'United States' },
  { code: 'NO', label: 'Norway' },
] as const;

const DURATIONS = [
  { value: '', label: 'Any length' },
  { value: 'short', label: 'Under 1 hour' },
  { value: 'medium', label: '1–3 hours' },
  { value: 'long', label: '3–6 hours' },
  { value: 'day', label: 'Full day' },
  { value: 'multi', label: 'Multi-day' },
] as const;

/* ── Helpers ──────────────────────────────────────────────────── */

async function fetchTypeahead(q: string, signal?: AbortSignal): Promise<TypeaheadData> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: TYPEAHEAD_QUERY, variables: { q, limit: 8 } }),
    signal,
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

/* ── Icons ────────────────────────────────────────────────────── */

function GlobeIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-neutral-500"
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
      className="h-4 w-4 shrink-0 text-neutral-500"
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
      className="h-4 w-4 shrink-0 text-neutral-500"
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
      className="h-4 w-4 shrink-0 text-neutral-500"
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

/* ── Styles ───────────────────────────────────────────────────── */

const selectStyle: React.CSSProperties = {
  appearance: 'none',
  background: 'transparent',
  border: 'none',
  color: 'var(--mv-ink)',
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  paddingRight: 16,
  width: '100%',
};

const selectLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-geist-mono, monospace)',
  fontSize: 9,
  color: 'var(--mv-ink-3)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  lineHeight: 1,
};

/* ── Component ────────────────────────────────────────────────── */

export function ExploreSearchBar({
  countries: countriesProp,
}: {
  countries?: Array<{ code: string; label: string }>;
}) {
  const countryOptions = useMemo(() => {
    const list =
      countriesProp && countriesProp.length > 0 ? countriesProp : [...FALLBACK_COUNTRIES];
    return [{ code: '', label: 'Anywhere' }, ...list];
  }, [countriesProp]);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [country, setCountry] = useState(searchParams.get('country') ?? '');
  const [duration, setDuration] = useState(searchParams.get('duration') ?? '');
  const [data, setData] = useState<TypeaheadData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  // Sync state from URL on back-button / external navigation
  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setCountry(searchParams.get('country') ?? '');
    setDuration(searchParams.get('duration') ?? '');
  }, [searchParams]);

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

  // Debounced fetch with AbortController to prevent stale responses
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setData(null);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetchTypeahead(query.trim(), controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setData(result);
          setIsOpen(result.routes.length > 0 || result.places.length > 0);
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setData(null);
          setIsOpen(false);
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
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

  // Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setIsOpen(false);
      setQuery('');
      router.push(href);
    },
    [router],
  );

  const handleChipClick = useCallback((chipQuery: string) => {
    setQuery(chipQuery);
    inputRef.current?.focus();
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || allItems.length === 0) {
        const canSubmit =
          query.trim().length >= MIN_QUERY_LENGTH || country !== '' || duration !== '';
        if (e.key === 'Enter' && canSubmit) {
          e.preventDefault();
          const params = new URLSearchParams();
          if (query.trim()) params.set('q', query.trim());
          if (country) params.set('country', country);
          if (duration) params.set('duration', duration);
          router.push(`/explore/search?${params.toString()}`);
        }
        return;
      }

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
    [isOpen, allItems, activeIndex, navigate, query, country, duration, router],
  );

  const handleSearch = useCallback(() => {
    const canSubmit = query.trim().length >= MIN_QUERY_LENGTH || country !== '' || duration !== '';
    if (!canSubmit) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (country) params.set('country', country);
    if (duration) params.set('duration', duration);
    router.push(`/explore/search?${params.toString()}`);
  }, [query, country, duration, router]);

  const placesCount = data?.places.length ?? 0;

  return (
    <div ref={containerRef}>
      {/* Glassmorphic Search Bar */}
      <div style={{ marginTop: 40, position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            background: 'oklch(0.15 0.012 55 / 0.7)',
            backdropFilter: 'blur(24px)',
            border: '1px solid var(--mv-line)',
            borderRadius: 20,
            padding: 8,
            boxShadow: '0 30px 60px -30px oklch(0 0 0 / 0.7)',
          }}
        >
          {/* Search input */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '0 20px',
              minWidth: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--mv-ink-2)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <title>Search</title>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
              placeholder='Try "Alps" &middot; "coastal Portugal" &middot; "weekend near Barcelona"'
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--mv-ink)',
                fontSize: 15,
                fontFamily: 'inherit',
                letterSpacing: '-0.005em',
              }}
              aria-label="Search motorcycle routes"
              role="combobox"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-controls="typeahead-listbox"
              aria-activedescendant={activeIndex >= 0 ? `typeahead-item-${activeIndex}` : undefined}
              autoComplete="off"
            />
            {isLoading && (
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '2px solid var(--mv-line)',
                  borderTopColor: 'var(--mv-warm-400)',
                  animation: 'spin 0.6s linear infinite',
                  flexShrink: 0,
                }}
              />
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              margin: '8px 0',
              background: 'var(--mv-line)',
            }}
          />

          {/* Country filter */}
          <div
            style={{
              padding: '8px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 110,
              position: 'relative',
            }}
          >
            <span style={selectLabelStyle}>Country</span>
            <div style={{ position: 'relative' }}>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={selectStyle}
                aria-label="Filter by country"
              >
                {countryOptions.map((c) => (
                  <option key={c.code} value={c.code} style={{ background: '#1a1a1a' }}>
                    {c.label}
                  </option>
                ))}
              </select>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--mv-ink-3)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <title>Expand</title>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              margin: '8px 0',
              background: 'var(--mv-line)',
            }}
          />

          {/* Duration filter */}
          <div
            style={{
              padding: '8px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 110,
              position: 'relative',
            }}
          >
            <span style={selectLabelStyle}>Duration</span>
            <div style={{ position: 'relative' }}>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={selectStyle}
                aria-label="Filter by duration"
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value} style={{ background: '#1a1a1a' }}>
                    {d.label}
                  </option>
                ))}
              </select>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--mv-ink-3)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <title>Expand</title>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={handleSearch}
            style={{
              padding: '0 28px',
              background: 'var(--mv-warm-500)',
              color: '#000',
              border: 'none',
              borderRadius: 14,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.2s, transform 0.2s',
              flexShrink: 0,
            }}
          >
            Search
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Go</title>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {/* Typeahead dropdown */}
        {isOpen && allItems.length > 0 && (
          <div
            id="typeahead-listbox"
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 8,
              zIndex: 50,
              overflow: 'hidden',
              borderRadius: 16,
              border: '1px solid var(--mv-line)',
              background: 'oklch(0.12 0.01 55 / 0.95)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 30px 60px -15px oklch(0 0 0 / 0.6)',
            }}
          >
            {/* Places */}
            {data && data.places.length > 0 && (
              <div>
                <div
                  style={{
                    padding: '10px 16px 4px',
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 10,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Locations
                </div>
                {data.places.map((place, i) => (
                  <button
                    key={`place-${place.id}`}
                    id={`typeahead-item-${i}`}
                    role="option"
                    type="button"
                    aria-selected={activeIndex === i}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 16px',
                      border: 'none',
                      background: activeIndex === i ? 'oklch(0.76 0.18 60 / 0.08)' : 'transparent',
                      color: activeIndex === i ? 'var(--mv-ink)' : 'var(--mv-ink-2)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => navigate(buildPlaceHref(place))}
                  >
                    <KindIcon kind={place.kind} />
                    <span
                      style={{
                        flex: 1,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {place.name}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-geist-mono, monospace)',
                        fontSize: 10,
                        color: 'var(--mv-ink-3)',
                        letterSpacing: '0.08em',
                        textTransform: 'capitalize',
                      }}
                    >
                      {place.kind}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Routes */}
            {data && data.routes.length > 0 && (
              <div>
                {placesCount > 0 && (
                  <div style={{ margin: '0 16px', borderTop: '1px solid var(--mv-line)' }} />
                )}
                <div
                  style={{
                    padding: '10px 16px 4px',
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 10,
                    color: 'var(--mv-ink-3)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
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
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 16px',
                        border: 'none',
                        background:
                          activeIndex === idx ? 'oklch(0.76 0.18 60 / 0.08)' : 'transparent',
                        color: activeIndex === idx ? 'var(--mv-ink)' : 'var(--mv-ink-2)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 14,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => navigate(buildRouteHref(route))}
                    >
                      <MapIcon />
                      <span
                        style={{
                          flex: 1,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {route.name}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-geist-mono, monospace)',
                          fontSize: 10,
                          color: 'var(--mv-ink-3)',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {route.countryCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer hint */}
            <div
              style={{
                borderTop: '1px solid var(--mv-line)',
                padding: '8px 16px',
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 11,
                color: 'var(--mv-ink-4)',
              }}
            >
              <kbd
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'oklch(0.2 0.01 55)',
                  fontSize: 10,
                }}
              >
                &uarr;&darr;
              </kbd>{' '}
              navigate{' '}
              <kbd
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'oklch(0.2 0.01 55)',
                  fontSize: 10,
                  marginLeft: 4,
                }}
              >
                Enter
              </kbd>{' '}
              select{' '}
              <kbd
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'oklch(0.2 0.01 55)',
                  fontSize: 10,
                  marginLeft: 4,
                }}
              >
                Esc
              </kbd>{' '}
              close
            </div>
          </div>
        )}
      </div>

      {/* Quick Chips + Shortcut hint */}
      <div
        style={{
          marginTop: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            columnGap: 8,
            rowGap: 10,
            alignItems: 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-geist-mono, monospace)',
              fontSize: 10,
              color: 'var(--mv-ink-3)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginRight: 6,
              whiteSpace: 'nowrap',
            }}
          >
            Popular:
          </span>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.query}
              type="button"
              onClick={() => handleChipClick(chip.query)}
              style={{
                padding: '7px 13px 7px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                borderRadius: 999,
                background: 'oklch(1 0 0 / 0.03)',
                border: '1px solid var(--mv-line)',
                color: 'var(--mv-ink-2)',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--mv-warm-500)',
                }}
              />
              {chip.label}
            </button>
          ))}
        </div>

        {/* Cmd+K hint */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            color: 'var(--mv-ink-4)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <kbd
            style={{
              padding: '3px 7px',
              borderRadius: 5,
              border: '1px solid var(--mv-line)',
              background: 'oklch(0.15 0.01 55)',
              fontSize: 10,
              lineHeight: 1,
            }}
          >
            &#8984;
          </kbd>
          <kbd
            style={{
              padding: '3px 7px',
              borderRadius: 5,
              border: '1px solid var(--mv-line)',
              background: 'oklch(0.15 0.01 55)',
              fontSize: 10,
              lineHeight: 1,
            }}
          >
            K
          </kbd>
          <span style={{ marginLeft: 2 }}>to search anywhere</span>
        </div>
      </div>
    </div>
  );
}
