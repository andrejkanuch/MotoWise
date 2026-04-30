---
title: "feat: Dynamic Explore Page & Functional Search"
type: feat
status: active
date: 2026-04-30
deepened: 2026-04-30
---

# feat: Dynamic Explore Page & Functional Search

## Enhancement Summary

**Deepened on:** 2026-04-30
**Review agents:** Architecture, Security, Performance, TypeScript, Frontend Races, Code Simplicity
**External docs:** Next.js 16 searchParams (Context7)

### Key Improvements from Reviews
1. **Split route** to preserve ISR: keep `/explore` static, create `/explore/search` for dynamic results
2. **AbortController** for typeahead race condition (stale fetch overwrites fresh results)
3. **Allowlist country param** against known codes instead of passing arbitrary strings
4. **Cache fetchCountries** separately (30 rows, changes rarely)
5. **Cut scope**: drop region code normalization and theme count changes — separate PR

### Scope Reduction (from Simplicity Review)
Items 1-6 from the original plan are essential. Items 7-9 (simplify duration options, remove hardcoded theme counts, normalize region codes) are scope creep for a solo developer with 107 routes. Ship search first, polish later.

---

## Overview

The `/explore` page displays hardcoded stats, a partially-dynamic country grid, and a search bar whose submit action is a dead end. This plan wires up the full search pipeline: reading URL search params, passing them to the GraphQL API, rendering filtered results, and making all stats/copy reflect real data.

**Already done in this session (DB + code):**
- `trips.country_code` uppercased (65 rows), CHECK constraint added
- `places` table synced — 22 missing countries inserted, route_counts updated (30 countries total)
- Stats bar, hero text, "All X countries" button, and search bar country dropdown are now dynamic
- `proof-section.tsx` updated from "40" to "30" countries

**Remaining work (this plan):**
1. Wire search params → filtered results on a dedicated search route
2. Map duration UI values to API filters
3. Hydrate search bar from URL params
4. Add empty state + "clear search" UX
5. Add AbortController to typeahead fetches
6. Cache fetchCountries with unstable_cache

## Problem Statement / Motivation

Users click "Search" on the explore page and the URL updates, but results never change — the page ignores `searchParams` entirely. The duration filter has no backend mapping. Country-only or duration-only searches are blocked by the 2-char minimum. This makes the search UX non-functional despite a polished UI.

## Proposed Solution

### Architecture: Split Route (from Architecture Review)

**Critical insight:** Accessing `searchParams` in Next.js 16 forces the entire page into dynamic rendering, killing ISR for the curated landing page. Solution: **split the route**.

```
/explore              → Static/ISR curated layout (revalidate=3600, SEO entry point)
/explore/search?q=Alps → Dynamic search results page (always fresh)
```

The search bar changes `router.push` target from `/explore?q=...` to `/explore/search?q=...`. The curated `/explore` page keeps its ISR caching. The search results page is always dynamic.

**Files:**
- `apps/web/src/app/explore/page.tsx` — unchanged (keeps ISR, no searchParams access)
- `apps/web/src/app/explore/search/page.tsx` — **NEW** — reads searchParams, renders filtered results
- `apps/web/src/components/explore-search-bar.tsx` — updated target URL, hydration, AbortController

### Duration Mapping Strategy

The UI has time-based labels but the API only has `dayCountMin`/`dayCountMax`. Keep the existing 6 duration options in the UI for now (simplification is a separate PR). Map pragmatically:

| UI Value | API Filter |
|----------|------------|
| `short` | `dayCountMax: 1` |
| `medium` | `dayCountMax: 1` |
| `long` | `dayCountMax: 1` |
| `day` | `dayCountMax: 1` |
| `multi` | `dayCountMin: 2` |
| (empty) | no filter |

All single-day options map to `dayCountMax: 1`. Only "multi-day" is distinct. This is honest given the data model.

## Technical Considerations

### Files to modify

| File | Change |
|------|--------|
| `apps/web/src/app/explore/search/page.tsx` | **NEW** — searchParams reading, filtered results rendering |
| `apps/web/src/components/explore-search-bar.tsx` | Target `/explore/search`, hydrate country/duration from URL, AbortController, relax min-query |
| `apps/web/src/app/explore/page.tsx` | No changes (preserves ISR) |

### Key patterns (from learnings)

- **PPR is disabled** (next-intl conflict) — `searchParams` works freely in server components (`docs/solutions/integration-issues/nextjs16-ppr-cache-components-next-intl-incompatibility.md`)
- **Public queries must use anonClient** — RLS enforced (`docs/solutions/security-issues/supabase-admin-client-on-public-queries.md`)
- **Text search uses `websearch` on `search_tsv`** — input must be capped at 100 chars (`docs/solutions/runtime-errors/typeahead-word-similarity-not-found.md`)
- **Run `pnpm generate`** after any GraphQL changes (`docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`)
- **Partial indexes exist** for `WHERE is_template = true` — GIN index on `search_tsv` eliminates non-template rows (`docs/solutions/architecture/trip-unification-three-entities-to-one.md`)

### Caching strategy (from Performance Review)

- `/explore` keeps `revalidate = 3600` (ISR) — no searchParams access
- `/explore/search` is always dynamic — no caching needed for search results
- `fetchCountries` should use `unstable_cache` with 3600s TTL — 30 rows that rarely change, eliminates 1 GraphQL call on search renders
- `fetchStaffPicks` over-fetches: calls `fetchTrips(12)` then filters to `isMotovaultPick`. Add `isMotovaultPick: true` to the GraphQL filter.

### Security hardening (from Security Review)

1. **Allowlist country param** — validate against known country codes from `COUNTRY_NAMES` in `@motovault/types` or `geo-names.ts`, reject unknown values
2. **Cap search input** — `q.slice(0, 100)` (already planned)
3. **Validate duration** — only accept known values (`short`, `medium`, `long`, `day`, `multi`), reject others
4. **websearch_to_tsquery error handling** — wrap in try/catch on the API side; malformed input (unbalanced quotes) can throw. Fall back to `plainto_tsquery`
5. **Rate limiting** — the API already has `@nestjs/throttler`. The PlacesResolver skips it (`@SkipThrottle()`). The TripTemplatesResolver should NOT skip throttle for public queries

### Race condition fixes (from Frontend Races Review)

1. **AbortController for typeahead** — the cleanup function clears the timeout but not in-flight fetch requests. Stale responses can overwrite fresh results when the user types fast.

```tsx
const abortRef = useRef<AbortController>();

useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current);
  abortRef.current?.abort();

  if (query.trim().length < MIN_QUERY_LENGTH) {
    setData(null);
    setIsOpen(false);
    return;
  }

  debounceRef.current = setTimeout(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    fetchTypeahead(query.trim(), controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setData(result);
        setIsOpen(result.routes.length > 0 || result.places.length > 0);
        setActiveIndex(-1);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setData(null);
        setIsOpen(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
  }, DEBOUNCE_MS);

  return () => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  };
}, [query]);
```

2. **Sync searchParams on back-button** — `initialQ` is computed once at mount; browser back-button changes URL but state stays stale:

```tsx
useEffect(() => {
  setQuery(searchParams.get('q') ?? '');
  setCountry(searchParams.get('country') ?? '');
  setDuration(searchParams.get('duration') ?? '');
}, [searchParams]);
```

### Type safety improvements (from TypeScript Review)

1. **Narrow searchParams type** — define `ExploreSearchParams` instead of inline `typeof` checks
2. **Duration as union** — `type DurationFilter = 'day' | 'multi' | 'short' | 'medium' | 'long'`
3. **Named country type** — reuse or define `CountryOption = { code: string; label: string }`

## System-Wide Impact

- **Interaction graph**: `ExploreSearchBar` → `router.push(/explore/search?params)` → Next.js renders `ExploreSearchPage` → reads `searchParams` → calls `gqlServerFetcher(TripTemplatesDocument, { filter })` → NestJS `TripTemplatesResolver.tripTemplates()` → `TripTemplatesService.listTemplates(filter)` → Supabase query with RLS
- **Error propagation**: GraphQL errors caught in `fetchTrips()` catch block → returns empty array → empty state rendered
- **State lifecycle risks**: None — read-only SSR, no mutations
- **API surface parity**: Mobile app also calls `TripTemplatesDocument` with the same filter — no divergence risk

## Acceptance Criteria

### Functional

- [ ] `/explore/search?q=Alps` shows filtered route results with "Alps" text search
- [ ] `/explore/search?country=IT` shows only Italian routes
- [ ] `/explore/search?duration=multi` shows only multi-day routes
- [ ] `/explore/search?q=Alps&country=IT` combines text + country filters
- [ ] `/explore` (no params) shows the default curated layout unchanged with ISR
- [ ] Search bar submits to `/explore/search?...` instead of `/explore?...`
- [ ] Search bar hydrates `q`, `country`, `duration` from URL on page load
- [ ] Country-only search works without text query (min-query relaxed)
- [ ] Duration-only search works without text query
- [ ] Empty state shown when search returns 0 results, with "back to explore" link
- [ ] Country param validated against known country codes
- [ ] Search input capped at 100 characters
- [ ] AbortController cancels stale typeahead requests
- [ ] Browser back-button syncs search bar state

### Quality

- [ ] `pnpm --filter web build` passes
- [ ] `pnpm --filter web typecheck` passes
- [ ] No new `any` types introduced
- [ ] All GraphQL types from `@motovault/graphql`

## Success Metrics

- Search submissions result in visible filtered route cards (not a dead end)
- All 30 countries appear in the search bar dropdown
- Stats bar shows accurate, real-time counts
- `/explore` ISR cache is preserved (verify with `x-nextjs-cache` header)

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| `search_tsv` not populated for all templates | Verify with SQL query before relying on text search |
| `websearch_to_tsquery` throws on malformed input | Wrap in try/catch, fall back to `plainto_tsquery` |
| ISR broken by accessing searchParams | Split route architecture avoids this entirely |
| Typeahead race conditions | AbortController + signal guard |

## MVP Implementation

### 1. `apps/web/src/app/explore/search/page.tsx` (NEW)

```tsx
import type { TripTemplatesQuery } from '@motovault/graphql';
import { TripTemplatesDocument } from '@motovault/graphql';
import { COUNTRY_NAMES } from '@/lib/geo-names';
import { gqlServerFetcher } from '@/lib/graphql-server';

type DurationFilter = 'short' | 'medium' | 'long' | 'day' | 'multi';
const VALID_DURATIONS = new Set<string>(['short', 'medium', 'long', 'day', 'multi']);
const VALID_COUNTRIES = new Set(Object.keys(COUNTRY_NAMES));

function mapDuration(d?: string): { dayCountMin?: number; dayCountMax?: number } {
  if (d === 'multi') return { dayCountMin: 2 };
  if (d && VALID_DURATIONS.has(d)) return { dayCountMax: 1 };
  return {};
}

export default async function ExploreSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { q: rawQ, country: rawCountry, duration: rawDuration } = await searchParams;
  const q = typeof rawQ === 'string' ? rawQ.slice(0, 100) : undefined;
  const country = typeof rawCountry === 'string' && VALID_COUNTRIES.has(rawCountry.toUpperCase())
    ? rawCountry.toUpperCase()
    : undefined;
  const duration = typeof rawDuration === 'string' && VALID_DURATIONS.has(rawDuration)
    ? rawDuration as DurationFilter
    : undefined;

  const filter = {
    ...(q ? { searchText: q } : {}),
    ...(country ? { country: country.toLowerCase() } : {}),
    ...mapDuration(duration),
  };

  let trips: TripTemplatesQuery['tripTemplates']['edges'][number]['node'][] = [];
  try {
    const data = await gqlServerFetcher(TripTemplatesDocument, { filter, first: 20 });
    trips = data.tripTemplates.edges.map((e) => e.node);
  } catch { /* empty results */ }

  const hasResults = trips.length > 0;
  const searchSummary = [
    q && `"${q}"`,
    country && COUNTRY_NAMES[country],
    duration === 'multi' ? 'multi-day' : duration ? 'day rides' : null,
  ].filter(Boolean).join(' in ');

  return (
    <section style={{ padding: '140px 40px 90px', maxWidth: 'var(--mv-container)', margin: '0 auto' }}>
      {/* Search bar (same as /explore) */}
      {/* Results header */}
      <h1>
        {hasResults ? `${trips.length} results` : 'No results'}
        {searchSummary && ` for ${searchSummary}`}
      </h1>
      <a href="/explore">Back to explore</a>

      {/* Results grid — reuse TripCard, same mv-grid-4 */}
      {hasResults ? (
        <div className="mv-grid-4" style={{ gap: 20, marginTop: 40 }}>
          {/* trips.map(trip => <TripCard trip={trip} />) */}
        </div>
      ) : (
        <div>
          <p>Try broadening your search or browse by country.</p>
          <a href="/explore">Explore all routes</a>
        </div>
      )}
    </section>
  );
}
```

### 2. Search bar updates (`explore-search-bar.tsx`)

```tsx
// Change submit target
router.push(`/explore/search?${params.toString()}`);

// Add AbortController to fetchTypeahead
async function fetchTypeahead(q: string, signal?: AbortSignal): Promise<TypeaheadData> {
  const res = await fetch(API_URL, { method: 'POST', headers: {...}, body: ..., signal });
  // ...
}

// Sync state from searchParams (for back-button)
useEffect(() => {
  setQuery(searchParams.get('q') ?? '');
  setCountry(searchParams.get('country') ?? '');
  setDuration(searchParams.get('duration') ?? '');
}, [searchParams]);

// Relax min-query when filters are set
const canSubmit = query.trim().length >= 2 || country !== '' || duration !== '';
```

## Out of Scope (separate PRs)

- Simplify duration options from 6 to 3
- Remove hardcoded curated theme route counts
- Normalize 64 bare region codes to ISO 3166-2
- Pagination / "Load more" for search results
- Dynamic metadata for search result pages
- Mobile responsive search bar layout

## Sources

- `apps/web/src/app/explore/page.tsx` — main page component (keep ISR)
- `apps/web/src/components/explore-search-bar.tsx` — client search bar
- `apps/api/src/modules/trips/dto/trip-template-filter.input.ts` — filter input type
- `apps/api/src/modules/trips/services/trip-templates.service.ts:68` — `listTemplates` with full filter support
- `apps/api/src/modules/places/places.service.ts` — `browseCountries()` query
- Next.js 16 searchParams docs (Context7 /vercel/next.js/v16.1.6)
- `docs/solutions/architecture/trip-unification-three-entities-to-one.md`
- `docs/solutions/runtime-errors/typeahead-word-similarity-not-found.md`
