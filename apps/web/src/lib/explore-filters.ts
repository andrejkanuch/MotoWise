/**
 * Shared explore-search filter constants and logic.
 *
 * Used by both the `ExploreSearchBar` (client) and the `/explore/search`
 * server page, so the duration options, validation set, and day_count
 * mapping stay in one place and cannot drift apart.
 */

/* ── Duration options ────────────────────────────────────────────── */

export const DURATION_OPTIONS = [
  { value: '', label: 'Any length' },
  { value: 'short', label: 'Under 1 hour' },
  { value: 'medium', label: '1–3 hours' },
  { value: 'long', label: '3–6 hours' },
  { value: 'day', label: 'Full day' },
  { value: 'multi', label: 'Multi-day' },
] as const;

export type DurationValue = (typeof DURATION_OPTIONS)[number]['value'];

/** Selectable (non-empty) duration values, for query-param validation. */
export const VALID_DURATIONS = new Set<string>(
  DURATION_OPTIONS.map((d) => d.value).filter((v) => v !== ''),
);

/** Human label for a duration value (e.g. `long` → `3–6 hours`). */
export const DURATION_LABELS: Record<string, string> = Object.fromEntries(
  DURATION_OPTIONS.filter((d) => d.value !== '').map((d) => [d.value, d.label]),
);

/**
 * Map a UI duration value to `day_count` bounds.
 *
 * The API only stores `day_count` (whole days), not estimated minutes, so
 * every single-day label (short/medium/long/day) collapses to `dayCountMax: 1`.
 * Only `multi` is distinct (`dayCountMin: 2`).
 */
export function mapDuration(d?: string): { dayCountMin?: number; dayCountMax?: number } {
  if (d === 'multi') return { dayCountMin: 2 };
  if (d && VALID_DURATIONS.has(d)) return { dayCountMax: 1 };
  return {};
}

/* ── Progressive fallback ladder ─────────────────────────────────── */

/** A user input that can be dropped to broaden a search. */
export type DropKey = 'duration' | 'query' | 'country';

export type ExploreSearchInput = {
  q?: string;
  /** Validated, uppercase ISO country code (e.g. `US`). */
  country?: string;
  duration?: string;
};

export type ExploreFilter = {
  searchText?: string;
  country?: string;
  dayCountMin?: number;
  dayCountMax?: number;
};

export type SearchAttempt = {
  filter: ExploreFilter;
  /** Which inputs were dropped vs. the user's original query. Empty = exact. */
  dropped: DropKey[];
};

/**
 * Order in which to relax filters when a search dead-ends. First entry is the
 * user's exact query; each subsequent entry drops one or more inputs. The list
 * is ordered to preserve the strongest intent signal for as long as possible:
 *
 *  1. exact                       (text + country + length)
 *  2. drop length                 — the text + place still matter most
 *  3. drop text                   — keep the place + length (the place is real even if no route is *named* for it)
 *  4. keep only the place
 *  5. drop the place              — search the text anywhere
 *  6. keep only the text
 *  7. drop everything             — surface popular routes rather than nothing
 */
const RELAXATION_LADDER: DropKey[][] = [
  [],
  ['duration'],
  ['query'],
  ['duration', 'query'],
  ['country'],
  ['duration', 'country'],
  ['duration', 'query', 'country'],
];

/**
 * Build the ordered list of search attempts for a query, deduping entries that
 * collapse to the same filter (e.g. dropping an input the user never set).
 * Pure — the caller runs each attempt until one returns routes.
 */
export function buildSearchAttempts(input: ExploreSearchInput): SearchAttempt[] {
  const q = input.q?.trim() || undefined;
  const country = input.country || undefined;
  const duration = input.duration || undefined;

  const filterFor = (drop: DropKey[]): ExploreFilter => ({
    ...(q && !drop.includes('query') ? { searchText: q } : {}),
    ...(country && !drop.includes('country') ? { country: country.toLowerCase() } : {}),
    ...(drop.includes('duration') ? {} : mapDuration(duration)),
  });

  const attempts: SearchAttempt[] = [];
  const seen = new Set<string>();
  for (const drop of RELAXATION_LADDER) {
    const filter = filterFor(drop);
    // Only keep the keys we actually dropped *and* the user had set — so the
    // notice reflects reality rather than no-op relaxations.
    const dropped = drop.filter(
      (k) => (k === 'query' && q) || (k === 'country' && country) || (k === 'duration' && duration),
    );
    const key = JSON.stringify(filter);
    if (seen.has(key)) continue;
    seen.add(key);
    attempts.push({ filter, dropped });
  }
  return attempts;
}
