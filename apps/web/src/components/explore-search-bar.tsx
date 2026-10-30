'use client';

import type { SearchTypeaheadQuery } from '@motovault/graphql';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@/components/explore/primitives';
import { DURATION_OPTIONS } from '@/lib/explore-filters';

/* ── Types ────────────────────────────────────────────────────── */

type RouteSuggestion = SearchTypeaheadQuery['searchTypeahead']['routes'][number];
type PlaceSuggestion = SearchTypeaheadQuery['searchTypeahead']['places'][number];
type TypeaheadData = SearchTypeaheadQuery['searchTypeahead'];

/* ── Constants ────────────────────────────────────────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const LISTBOX_ID = 'typeahead-listbox';
const HINT_ID = 'search-keyboard-hints';
const SHORT_QUERY_HINT_ID = 'search-short-query';

/** Why the suggestions are not showing, when it is not "nothing matched". */
const SuggestStatus = { Idle: 'idle', Error: 'error' } as const;
type SuggestStatus = (typeof SuggestStatus)[keyof typeof SuggestStatus];

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

const PLACE_KIND_ICON: Record<string, IconName> = {
  country: 'globe',
  region: 'pin',
};

const PLACE_KIND_LABEL: Record<string, string> = {
  country: 'Country',
  region: 'Region',
  city: 'City',
};

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

function placeKindLabel(kind: string): string {
  return PLACE_KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

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
  const [suggestStatus, setSuggestStatus] = useState<SuggestStatus>(SuggestStatus.Idle);
  // Set when "Search routes" is pressed with nothing to search for.
  const [shortQuery, setShortQuery] = useState(false);

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
      setSuggestStatus(SuggestStatus.Idle);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetchTypeahead(query.trim().slice(0, 100), controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setData(result);
          setSuggestStatus(SuggestStatus.Idle);
          setIsOpen(result.routes.length > 0 || result.places.length > 0);
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setData(null);
          setIsOpen(false);
          // Offline or the API is down: say so; the search itself still works.
          setSuggestStatus(SuggestStatus.Error);
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

  const canSubmit = query.trim().length >= MIN_QUERY_LENGTH || country !== '' || duration !== '';

  const handleSearch = useCallback(() => {
    if (!canSubmit) {
      setShortQuery(true);
      inputRef.current?.focus();
      return;
    }
    setShortQuery(false);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (country) params.set('country', country);
    if (duration) params.set('duration', duration);
    router.push(`/explore/search?${params.toString()}`);
  }, [canSubmit, query, country, duration, router]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || allItems.length === 0) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSearch();
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
    [isOpen, allItems, activeIndex, navigate, handleSearch],
  );

  const placesCount = data?.places.length ?? 0;
  const showShortQueryHint = shortQuery && !canSubmit;
  const describedBy = [HINT_ID, showShortQueryHint ? SHORT_QUERY_HINT_ID : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={containerRef}>
      <div style={{ position: 'relative' }}>
        {/* Three kit fields and the primary button in one row */}
        <div className="xp-field">
          <label className="mv-field xp-field-main">
            <span>Search routes</span>
            <span className="xp-input-wrap">
              <Icon name="search" size={18} />
              <input
                ref={inputRef}
                type="search"
                className="mv-field-input"
                value={query}
                maxLength={100}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => {
                  if (data && (data.routes.length > 0 || data.places.length > 0)) {
                    setIsOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search a pass, a coast, a town"
                aria-describedby={describedBy}
                aria-invalid={showShortQueryHint || undefined}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-controls={LISTBOX_ID}
                aria-activedescendant={
                  activeIndex >= 0 ? `typeahead-item-${activeIndex}` : undefined
                }
                autoComplete="off"
              />
              {isLoading && <span className="xp-spinner" aria-hidden="true" />}
            </span>
          </label>

          {/* Country filter */}
          <label className="mv-field xp-field-select">
            <span>Country</span>
            <span className="mv-select">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mv-field-input"
              >
                {countryOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" size={16} />
            </span>
          </label>

          {/* Duration filter */}
          <label className="mv-field xp-field-select">
            <span>Length</span>
            <span className="mv-select">
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mv-field-input"
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" size={16} />
            </span>
          </label>

          <button
            type="button"
            onClick={handleSearch}
            className="mv-btn mv-btn-primary xp-field-submit"
          >
            Search routes
            <Icon name="arrow-right" size={16} />
          </button>
        </div>

        {/* The combobox's description, present whether or not the list is open */}
        <span id={HINT_ID} className="sr-only">
          Arrow keys move through suggestions, Enter opens one, Escape closes the list.
        </span>

        {/* Typeahead dropdown: the listbox exists whenever the field does, so
            aria-controls never dangles; it shows only with suggestions in it */}
        <div
          id={LISTBOX_ID}
          role="listbox"
          aria-label="Suggestions"
          className="xp-dropdown mv-enter-down"
          hidden={!(isOpen && allItems.length > 0)}
        >
          {data && data.places.length > 0 && (
            <div role="presentation">
              <div className="xp-dropdown-head">
                <span className="xp-label">Places</span>
              </div>
              {data.places.map((place, i) => (
                <div
                  key={`place-${place.id}`}
                  id={`typeahead-item-${i}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={activeIndex === i}
                  className="xp-option"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => navigate(buildPlaceHref(place))}
                  onKeyDown={handleKeyDown}
                >
                  <span className="xp-option-icon">
                    <Icon name={PLACE_KIND_ICON[place.kind] ?? 'building'} size={16} />
                  </span>
                  <span className="xp-option-name">{place.name}</span>
                  <span className="xp-option-kind">{placeKindLabel(place.kind)}</span>
                </div>
              ))}
            </div>
          )}

          {data && data.routes.length > 0 && (
            <div role="presentation">
              {placesCount > 0 && <div className="xp-dropdown-rule" aria-hidden="true" />}
              <div className="xp-dropdown-head">
                <span className="xp-label">Routes</span>
              </div>
              {data.routes.map((route, i) => {
                const idx = placesCount + i;
                return (
                  <div
                    key={`route-${route.id}`}
                    id={`typeahead-item-${idx}`}
                    role="option"
                    tabIndex={-1}
                    aria-selected={activeIndex === idx}
                    className="xp-option"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => navigate(buildRouteHref(route))}
                    onKeyDown={handleKeyDown}
                  >
                    <span className="xp-option-icon">
                      <Icon name="map" size={16} />
                    </span>
                    <span className="xp-option-name">{route.name}</span>
                    <span className="xp-option-kind">{route.countryCode}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="xp-dropdown-foot" aria-hidden="true">
            <span>
              <kbd className="xp-kbd">↑</kbd> <kbd className="xp-kbd">↓</kbd> to move
            </span>
            <span>
              <kbd className="xp-kbd">Enter</kbd> to open
            </span>
            <span>
              <kbd className="xp-kbd">Esc</kbd> to close
            </span>
          </div>
        </div>
      </div>

      {suggestStatus === SuggestStatus.Error && (
        <p className="xp-typeahead-status" role="status">
          Suggestions didn't load. Press Enter to search anyway.
        </p>
      )}
      {showShortQueryHint && (
        <p id={SHORT_QUERY_HINT_ID} className="xp-typeahead-status" role="status">
          Type at least {MIN_QUERY_LENGTH} characters, or pick a country or a length.
        </p>
      )}

      {/* Quick chips + shortcut hint */}
      <div className="xp-search-foot">
        <div className="mv-chips">
          <span className="xp-label" style={{ marginRight: 4 }}>
            Try
          </span>
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.query}
              type="button"
              onClick={() => handleChipClick(chip.query)}
              className="mv-chip"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="xp-search-hint">
          <kbd className="xp-kbd">⌘</kbd>
          <kbd className="xp-kbd">K</kbd>
          <span>focuses the search from anywhere on the page</span>
        </div>
      </div>
    </div>
  );
}
