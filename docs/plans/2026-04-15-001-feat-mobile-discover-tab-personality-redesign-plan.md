---
title: "feat: Mobile Discover Tab Personality Redesign"
type: feat
status: active
date: 2026-04-15
origin: docs/brainstorms/2026-04-15-discovery-personality-brainstorm.md
deepened: 2026-04-15
---

# Mobile Discover Tab Personality Redesign

## Enhancement Summary

**Deepened on:** 2026-04-15
**Agents used:** Performance Oracle, Architecture Strategist, Code Simplicity Reviewer, Frontend Races Reviewer, TypeScript Reviewer, Security Sentinel, Pattern Recognition Specialist, TanStack Query Research, FlatList Header Research, Accessibility Research

### Key Improvements from Deepening

1. **Scope reduced by ~40%** — Remove TopRatedSection (redundant with Popular chip), NearYouSection (locale ≠ location), and Step 4 (trip planner is scope creep). Defer to follow-up PRs.
2. **Components consolidated: 6 → 3** — One `HorizontalRouteSection` (reusable), one `FilterChipRow` (shared by surface + country chips), one `TypeaheadSearch`. Extract existing inline code instead of creating from scratch.
3. **Road of the Week simplified** — No new resolver needed. Reuse existing featured route logic (first MotoVault Pick sorted by rating). Relabel in UI. Zero backend changes.
4. **P0 performance fix discovered** — Current `discover-routes.graphql` fetches `polyline` field (5-15 KB per route) that list views never render. Removing it cuts initial payload by 60-70%.
5. **HIGH-severity race conditions caught** — `setInterval` polyline animation leaks on unmount; map height animation causes layout jank. Both deferred to separate PR.
6. **Concrete accessibility patterns** — Props for every new UI element (horizontal scrolls, emoji flags, typeahead, filter chips, bottom sheet).

### New Considerations Discovered

- ListHeaderComponent is not virtualized — 8+ sections render eagerly. Defer below-fold sections with `requestAnimationFrame`.
- `select('*')` in Road of the Week service misses contributor join — would produce degraded data (TypeScript review HIGH severity).
- Query key `['routes', filterString]` risks collision with section keys — introduce `['routes', 'discover', filterString]`.
- Filter state should be one object (`{ chips, countryCode }`) not two separate `useState` calls — prevents cache/fetch mismatch.
- `focusManager` must be wired to `AppState` for TanStack Query tab-switching behavior in React Native.

---

## Overview

Transform the mobile Discover tab from an algorithmic infinite list into a curated, editorial-feeling discovery experience. The web already has typeahead search, country chips, editorial picks, and curated sections — mobile has a flat FlatList with client-side filtering. This plan brings mobile to parity with the web's editorial personality.

Builds on the completed Phase 1 web infrastructure (slugs, FTS, typeahead resolver, explore pages). All backend APIs exist — this is purely mobile UI/UX work. No new backend resolvers needed.

(see brainstorm: `docs/brainstorms/2026-04-15-discovery-personality-brainstorm.md`)

## Problem Statement

The Discover tab today is a data dump: collapsible map → inline text search (client-side only) → 5 filter chips → featured route (first pick from paginated list) → infinite route cards. No geographic browsing, no curated collections, no editorial voice. Calimoto wins on curation (tag-based collections), REVER wins on geographic discovery ("Best Roads by Country"). MotoVault wins on neither.

## Proposed Solution

Restructure the Discover tab into curated sections with editorial personality. Two connected changes:

1. **Discover tab layout** — Editor's Picks horizontal scroll, country chips, typeahead search, enhanced filter chips, relabeled hero card
2. **Route detail cleanup** — Kill the 2x2 action grid, move save/GPX to floating header

### What was cut (deferred to follow-up PRs)

| Cut item | Reason | Agent |
|----------|--------|-------|
| Road of the Week resolver | YAGNI — existing featured route logic suffices. Relabel in UI. | Simplicity, Architecture, Security |
| TopRatedSection | Redundant with "Popular" filter chip — shows same data in two places | Simplicity |
| NearYouSection | `expo-localization` returns device locale, not physical location. German user in Italy sees "Popular in Germany". Country chips already cover geographic discovery. | Simplicity |
| Step 4: Trip planner polish | Scope creep — polyline animation, accordion, snap points are separate concerns from "Discover tab personality" | Simplicity, Races |
| Map collapse on search focus | Adds complexity (height animation causes layout jank). Current scroll-based shrink is sufficient. | Races (HIGH severity) |

---

## Technical Approach

### Architecture

The current FlatList + ListHeaderComponent pattern stays. New sections are added to the header. New queries run in parallel via TanStack Query.

### Research Insight: FlatList Header Performance

`ListHeaderComponent` is **not virtualized** — it renders as a single monolithic block. All sections mount simultaneously. With 6+ sections, initial render can take 200-350ms on mid-range Android.

**Mitigations:**
1. Extract header into a memoized component (prevents remount on parent re-render)
2. Defer below-fold sections by one frame with `requestAnimationFrame`
3. Use horizontal `FlatList` (not `ScrollView`) for sections with 6+ items
4. Wrap all section components in `React.memo`

### Key Design Decisions

1. **No new backend resolver** — Road of the Week is a UI label change on the existing featured route (first MotoVault Pick sorted by rating). Zero backend work.
2. **3 new components, not 6** — `HorizontalRouteSection` (reusable), `FilterChipRow` (shared), `TypeaheadSearch`. Plus extract existing inline code into `FeaturedRouteCard`.
3. **Typeahead search from day one** — `searchTypeahead` resolver exists, is public, rate-limited. Copy `.graphql` from web, run codegen.
4. **Drop client-side text filter** — once typeahead is live, all search goes through server. Remove `onSearchTextChange` and the `allRoutes.filter()` logic.
5. **Single filter state object** — `{ chips: Set<FilterKey>, countryCode: string | null }` to prevent cache/fetch mismatch between separate `useState` calls.

### Research Insight: Query Key Strategy

The current main list key `['routes', ...activeFilters]` risks collision with section keys. Use a namespaced hierarchy:

```typescript
// lib/query-keys.ts
routes: {
  all: ['routes'] as const,                                    // root for broad invalidation
  discover: (filters: string) => ['routes', 'discover', filters] as const,  // main list (useInfiniteQuery)
  editorPicks: ['routes', 'editorPicks'] as const,             // useQuery
  detail: (routeId: string) => ['routes', 'detail', routeId] as const,
  saved: ['routes', 'saved'] as const,
  gpxQuota: ['routes', 'gpx-quota'] as const,
}
```

### Research Insight: TanStack Query Settings

```typescript
// Per-section staleTime overrides (global default is 2min)
editorPicks:     staleTime: 10 * 60 * 1000  // 10 min — curated, changes rarely
discoverRoutes:  staleTime: 5 * 60 * 1000   // 5 min — main browsing list

// Wire up focusManager for tab-switching in RN:
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});

// Use placeholderData to derive editor picks from cached main feed:
placeholderData: () => {
  const feedData = queryClient.getQueryData(queryKeys.routes.discover(''));
  if (!feedData) return undefined;
  return { discoverRoutes: { edges: feedData.discoverRoutes.edges.filter(e => e.node.isMotovaultPick) } };
}

// keepPreviousData on typeahead to prevent results flash:
placeholderData: keepPreviousData
```

### Gotchas from Institutional Learnings

| Learning | Impact | Mitigation |
|----------|--------|------------|
| **TanStack Query cache collision** (useQuery vs useInfiniteQuery key clash) | Editor picks uses `useQuery`, main list uses `useInfiniteQuery` | Namespaced keys: `routes.discover()` vs `routes.editorPicks` |
| **oklch colors don't work in RN** | New chips, cards need colors | Always import from `palette` (hex), never `colors` (oklch) |
| **GraphQL contract drift** | New `.graphql` files | Run `pnpm generate` after every `.graphql` change before writing mobile code |
| **Server-side aggregation** | Country route counts should not be computed client-side | Country chips are static (no counts). Defer counts to Phase 4. |

---

## Implementation Steps

### Step 1: GraphQL + Type Setup (no backend changes)

**Files to create/modify:**

- `apps/mobile/src/graphql/queries/search-typeahead.graphql` — **New file** (copy from web)
- `apps/mobile/src/graphql/queries/discover-routes.graphql` — Add `countryCode`, `regionCode`, `slug` to selection set. **Remove `polyline`** (P0 performance fix — list views never render it)
- `apps/mobile/src/graphql/queries/discover-routes-map.graphql` — **New file** with `polyline` + `startLat` + `startLng` only, for map pin rendering
- `packages/types/src/constants/countries.ts` — **New file**: shared `SUPPORTED_COUNTRY_CODES` + `SupportedCountryCode` type

**Research Insight: Remove polyline from list queries (P0)**

The current `discover-routes.graphql` selects `polyline` which is 5-15 KB per route. The list/section views never render it — only the map uses `startLat`/`startLng` for pins. With 20 routes in the main list + 10 editor picks = 30 routes × ~10 KB = **~300 KB of unnecessary polyline data**.

Split into two queries:
- `discover-routes.graphql` (list fields, no polyline) — used by all sections and the main list
- `discover-routes-map.graphql` (polyline + coordinates only) — used by map pin rendering

**After this step:** Run `pnpm generate` to regenerate all types.

### Step 2: Discover Tab Layout Restructure

**File:** `apps/mobile/src/app/(tabs)/(discover)/index.tsx` (refactor from 772 → ~400 lines)

**Components to create (3 new + 1 extraction):**

| Component | File | Purpose |
|-----------|------|---------|
| `HorizontalRouteSection` | `components/discover/horizontal-route-section.tsx` | Reusable self-fetching horizontal scroll. Parameterized by title, icon, query filter. Used for Editor's Picks. |
| `FilterChipRow` | `components/discover/filter-chip-row.tsx` | Extracted from inline chips (lines 488-543). Serves both surface/popularity chips AND country chips. |
| `TypeaheadSearch` | `components/discover/typeahead-search.tsx` | Search bar + dropdown with routes/places results. Replaces inline TextInput (lines 441-485). |
| `FeaturedRouteCard` | `components/discover/featured-route-card.tsx` | Extracted from inline hero card (lines 546-648). Relabeled "Road of the Week". |

**Research Insight: Component Consolidation (Pattern Recognition)**

The codebase already has duplication between `TripSection` and `GroupRideSection` — both are structurally identical horizontal scroll sections. Adding 3 more copies would create 5 near-identical components. `HorizontalRouteSection` is parameterized:

```typescript
interface HorizontalRouteSectionProps {
  title: string;
  icon: LucideIcon;
  queryKey: readonly unknown[];
  filter: DiscoverRoutesFilterInput;
  first?: number;
  emptyMessage?: string;
  onRoutePress: (routeId: string) => void;
  staleTime?: number;
}
```

**Layout (new ListHeaderComponent):**

```
┌──────────────────────────────┐
│ Collapsible Mapbox Map       │  ← Unchanged (280px, shrinks on scroll)
├──────────────────────────────┤
│ <TypeaheadSearch />          │  ← Replaces inline TextInput
│ <FilterChipRow               │  ← Extracted: +Mixed, +Highly Rated
│   chips={FILTER_CHIPS}       │
│   active={filters.chips} />  │
├──────────────────────────────┤
│ <FeaturedRouteCard />        │  ← Extracted from inline code, relabeled "Road of the Week"
├──────────────────────────────┤
│ <HorizontalRouteSection      │  ← Editor's Picks (motovaultPicksOnly)
│   title="Editor's Picks"     │
│   filter={{ motovaultPicksOnly: true, sortByRating: true }}
│   icon={Award} />            │
├──────────────────────────────┤
│ <FilterChipRow               │  ← Country chips (same component, different data)
│   chips={COUNTRY_CHIPS}      │
│   active={filters.countryCode ? new Set([filters.countryCode]) : new Set()}
│   onToggle={handleCountryToggle} />
├──────────────────────────────┤
│ <TripSection />              │  ← Unchanged (wrap in React.memo)
├──────────────────────────────┤
│ "All Routes" section header  │
│ RouteCard (infinite list)    │  ← Existing FlatList data
└──────────────────────────────┘
```

**Research Insight: Deferred Rendering (FlatList Research)**

```typescript
const [showBelowFold, setShowBelowFold] = useState(false);

useEffect(() => {
  const id = requestAnimationFrame(() => setShowBelowFold(true));
  return () => cancelAnimationFrame(id);
}, []);

// Above fold (render immediately): TypeaheadSearch, FilterChipRow, FeaturedRouteCard
// Below fold (deferred): HorizontalRouteSection, CountryChips, TripSection
```

**Research Insight: Memoized Header (Performance + Races)**

Extract `ListHeaderComponent` into a stable, memoized component:

```typescript
const DiscoverHeader = memo(function DiscoverHeader({
  filters, onToggleFilter, onCountrySelect,
  featuredRoute, onRoutePress, showBelowFold,
}: DiscoverHeaderProps) {
  // All header content
});

// In parent — stable reference:
const headerComponent = useMemo(() => (
  <DiscoverHeader
    filters={filters}
    onToggleFilter={toggleFilter}
    onCountrySelect={handleCountrySelect}
    featuredRoute={featuredRoute}
    onRoutePress={handleRoutePress}
    showBelowFold={showBelowFold}
  />
), [filters, featuredRoute, showBelowFold, toggleFilter, handleCountrySelect, handleRoutePress]);
```

**Research Insight: Consolidated Filter State (Races)**

```typescript
// Single state object prevents cache/fetch mismatch
const [filters, setFilters] = useState<{
  chips: Set<FilterKey>;
  countryCode: string | null;
}>({ chips: new Set(), countryCode: null });

// One derivation for both queryKey and filterInput
const filterInput = useMemo((): DiscoverRoutesFilterInput | undefined => {
  const filter: DiscoverRoutesFilterInput = {};
  let hasFilter = false;
  // ... build from filters.chips (same as today)
  if (filters.countryCode) {
    filter.countryCode = filters.countryCode;
    hasFilter = true;
  }
  return hasFilter ? filter : undefined;
}, [filters]);

const queryKey = useMemo(
  () => queryKeys.routes.discover(JSON.stringify(filterInput ?? {})),
  [filterInput],
);
```

**TypeaheadSearch component:**

```typescript
interface TypeaheadSearchProps {
  onRouteSelect: (routeId: string) => void;
  onPlaceSelect: (countryCode: string, regionCode?: string) => void;
}
```

- Calls `useColorScheme()` internally (no `isDark` prop — TypeScript review)
- Debounce: 250ms, minimum 2 characters (match web)
- Uses `SearchTypeaheadDocument` query with `placeholderData: keepPreviousData`
- Dropdown grouped: "Routes" section + "Places" section
- Dismiss dropdown when filter chip is toggled (Races review — coherence gap)
- `AccessibilityInfo.announceForAccessibility()` when results change (Accessibility research)

**FilterChipRow component:**

```typescript
interface FilterChipRowProps<K extends string> {
  chips: ReadonlyArray<{ key: K; label: string; icon?: LucideIcon; emoji?: string }>;
  activeKeys: Set<K>;
  onToggle: (key: K) => void;
}
```

- Serves both filter chips and country chips (Pattern recognition)
- `accessibilityRole="button"` + `accessibilityState={{ selected }}` on each chip
- Mutually exclusive surface chips use `accessibilityRole="radio"` inside `accessibilityRole="radiogroup"` (Accessibility)
- Emoji flags hidden from accessibility: `importantForAccessibility="no-hide-descendants"` on emoji Text (Accessibility)

**Country chips data (shared type):**

```typescript
// packages/types/src/constants/countries.ts
export const SUPPORTED_COUNTRY_CODES = [
  'IT', 'ES', 'AT', 'DE', 'FR', 'CH', 'HR', 'GR', 'NO', 'RO', 'PT', 'US',
] as const;
export type SupportedCountryCode = (typeof SUPPORTED_COUNTRY_CODES)[number];

export function isSupportedCountry(code: string | undefined): code is SupportedCountryCode {
  return code != null && (SUPPORTED_COUNTRY_CODES as ReadonlyArray<string>).includes(code);
}
```

```typescript
// In mobile — country chips using FilterChipRow
const COUNTRY_CHIPS = SUPPORTED_COUNTRY_CODES.map(code => ({
  key: code,
  label: COUNTRY_NAMES[code],
  emoji: COUNTRY_EMOJIS[code],
}));
```

**HorizontalRouteSection:**

- Uses horizontal `FlatList` (not ScrollView) for virtualization (FlatList research)
- `initialNumToRender={3}`, `maxToRenderPerBatch={2}`, `windowSize={5}`
- `getItemLayout` for fixed-width cards (280pt + 12pt gap)
- Self-fetching with its own `useQuery` and `staleTime` override
- Wraps cards in `React.memo`
- Hides entirely if no data returned

**Map pin onPress (quick win):**

```typescript
<MapboxGL.ShapeSource
  id="route-pins"
  shape={routeGeoJSON}
  onPress={(e) => {
    const feature = e.features?.[0];
    if (feature?.properties?.id) {
      handleRoutePress(feature.properties.id);
    }
  }}
>
```

**Research Insight: Cap Animation Delay (Performance)**

```typescript
// In RouteCard — cap stagger delay to prevent multi-second delays on deep items
const animDelay = Math.min(index * 40, 300);
entering={reducedMotion ? undefined : FadeInUp.delay(animDelay).duration(250)}
```

**Research Insight: Reduce Motion Support (Accessibility)**

```typescript
const reducedMotion = useReducedMotion();
// Already used in codebase — apply to all new animations
// Map scroll interpolation: snap instantly instead of interpolating
```

**Query count on initial load: 3 (down from 6)**

| Query | Type | Notes |
|-------|------|-------|
| `discoverRoutes` (main list) | useInfiniteQuery | Existing, minus polyline |
| `discoverRoutes` (editor picks) | useQuery | Reuses query with `motovaultPicksOnly` filter |
| `getTrips` (trip section) | useQuery | Already fetched by TripSection |

Remove duplicate `getTrips` fetch from parent `index.tsx` (line 158) — `TripSection` already fetches this.

### Step 3: Route Detail — Kill the 2x2 Grid

**File:** `apps/mobile/src/app/(modals)/route-detail.tsx`

**New floating header (top-right):**
- Map style cycle button (existing)
- **Save/bookmark toggle** (heart or bookmark icon, filled when saved)
- Share button (existing)
- **`···` overflow menu** (ActionSheetIOS on iOS, custom on Android)
  - Export GPX
  - Report Route

**Remove from bottom sheet:**
- The entire 2x2 `ActionButton` grid
- `PremiumWaitlistModal` trigger (offline button removed)

**Bottom sheet content becomes:**
```
├─ MotoVault Pick badge (if applicable)
├─ Route name (22pt bold)
├─ Contributor byline
├─ Stats grid (distance, elevation, surface, rating, fuel)
├─ Description                    ← now has room
├─ ReviewList                     ← more visible
├─ "Leave a Review" button
└─ CommentList
```

**Save button behavior:**
- Uses existing `toggleRouteSave` mutation
- Unfilled bookmark icon → filled on save
- Haptic: `NotificationFeedbackType.Success`
- `accessibilityLabel={isSaved ? 'Unsave route' : 'Save route'}`

**Research Insight: No access control change (Security)**

Moving GPX export to overflow menu is purely UI. The same auth guard → throttle → entitlement check → quota → signed URL chain applies regardless of which button triggers it. No security impact.

---

## Accessibility Patterns

**Research from Accessibility Agent — concrete props for every new UI element:**

| Pattern | Props |
|---------|-------|
| Horizontal scroll sections | Wrap in `accessibilityRole="list"`, items get `accessibilityHint="X of Y"` |
| Emoji flags in country chips | `importantForAccessibility="no-hide-descendants"` on emoji Text; parent Pressable carries full label |
| Typeahead results | `AccessibilityInfo.announceForAccessibility()` (iOS+Android) + `accessibilityLiveRegion="polite"` on count text (Android) |
| Filter chips (toggle) | `accessibilityRole="button"` + `accessibilityState={{ selected }}` |
| Surface chips (exclusive) | `accessibilityRole="radio"` inside `accessibilityRole="radiogroup"` |
| Featured hero card | `accessibilityLabel` prefixed with "Editor's Pick, featured route:" + `accessibilityRole="header"` on badge |
| Reduce motion | `useReducedMotion()` from reanimated — snap instantly instead of interpolating |

---

## System-Wide Impact

### Interaction Graph

- **TypeaheadSearch** → calls existing `searchTypeahead` resolver (@Public) → Supabase `typeahead_search` RPC → returns routes + places
- **Country chips** → sets `countryCode` on `DiscoverRoutesFilterInput` → existing server-side filter path
- **Editor's Picks** → calls existing `discoverRoutes` with `motovaultPicksOnly: true` → existing filter path
- **Save button (moved)** → same `toggleRouteSave` mutation, just different UI location

### Error & Failure Propagation

- **Typeahead search fails**: Dropdown shows "No results" after debounce. Falls back gracefully.
- **Editor's Picks query fails**: Section hidden. Non-blocking.
- **Typeahead + chip coherence**: Dismiss typeahead dropdown when any filter chip is toggled.

### State Lifecycle Risks

- **Filter state**: Single `useState` object (`{ chips, countryCode }`) prevents cache/fetch mismatch.
- **Filter state reset on tab switch**: Accept — filters are transient.

### API Surface Parity

- **No new queries or mutations** — everything uses existing resolvers
- **Schema addition**: `countryCode`, `regionCode`, `slug` added to mobile `discover-routes.graphql` selection set (already on Route type)

---

## Acceptance Criteria

### Functional Requirements

- [ ] Featured route hero card relabeled as "Road of the Week" with editorial description
- [ ] Editor's Picks horizontal section shows up to 10 curated routes via `HorizontalRouteSection`
- [ ] 12 country chips render in horizontal scroll with emoji flags via `FilterChipRow`
- [ ] Tapping a country chip filters the main route list by `countryCode`
- [ ] Typeahead search returns routes + places with grouped dropdown
- [ ] Tapping a typeahead route result navigates to route-detail
- [ ] Tapping a typeahead place result sets country/region filter
- [ ] Typeahead dropdown dismisses when a filter chip is toggled
- [ ] Filter chips include: Popular, Picks, Twisty, Paved, Mixed, Off-road, Highly Rated
- [ ] Surface chips (Paved, Mixed, Off-road) are mutually exclusive
- [ ] Route map pins are tappable (navigate to route-detail)
- [ ] Route detail: Save is a bookmark icon in floating header
- [ ] Route detail: GPX export is in `···` overflow menu
- [ ] Route detail: Offline button removed entirely
- [ ] Route detail: 2x2 action grid removed

### Performance Requirements

- [ ] `polyline` removed from list/section queries (P0 — 60-70% payload reduction)
- [ ] `ListHeaderComponent` extracted into memoized component
- [ ] Below-fold sections deferred by one frame with `requestAnimationFrame`
- [ ] Horizontal sections with 6+ items use `FlatList` (not `ScrollView`)
- [ ] All section components wrapped in `React.memo`
- [ ] `TripSection` wrapped in `React.memo`
- [ ] RouteCard `FadeInUp.delay` capped at 300ms
- [ ] Per-section `staleTime` overrides (10min for editor picks, 5min for main list)
- [ ] `focusManager` wired to `AppState` for tab-switching

### Non-Functional Requirements

- [ ] Zero hardcoded colors — all from `@motovault/design-system` palette
- [ ] Zero `any` types — all GraphQL data typed from `@motovault/graphql`
- [ ] `SupportedCountryCode` type shared via `@motovault/types`
- [ ] Country chip `accessibilityLabel` includes full country name
- [ ] Emoji flags hidden from accessibility (`importantForAccessibility="no-hide-descendants"`)
- [ ] Surface chips use `accessibilityRole="radiogroup"` / `"radio"`
- [ ] Typeahead results announced via `AccessibilityInfo.announceForAccessibility()`
- [ ] All animations respect `useReducedMotion()`
- [ ] Stagger animations: `FadeInUp.delay(index * 50)` (per CLAUDE.md)

### Quality Gates

- [ ] `pnpm generate` produces no untracked changes
- [ ] `pnpm lint` passes (Biome)
- [ ] `pnpm test` passes
- [ ] Typecheck passes (`pnpm typecheck`)

## Dependencies & Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Large ListHeaderComponent hurts scroll perf | Medium | Medium | Deferred rendering, memoized header, horizontal FlatLists, React.memo on sections |
| 3 parallel queries slow on cellular | Low | Low | staleTime prevents redundant refetches. placeholderData for instant previews. |
| Typeahead + filter chip incoherence | Medium | Low | Dismiss dropdown on chip toggle |
| Country chip stale after travel | Low | Low | Based on device locale, not GPS. Acceptable. |
| Duplicate `getTrips` fetch | Already exists | Low | Remove parent fetch, let TripSection own it |

## Follow-up PRs (deferred from this scope)

| PR | Contents | Why deferred |
|----|----------|-------------|
| **Trip planner polish** | Bottom sheet 45%, metadata accordion, polyline `lineTrimOffset` animation, distance counter | Scope creep. `setInterval` animation needs `requestAnimationFrame` + cancel token. Map height animation causes layout jank. |
| **Near You section** | Locale-detected country section | Locale ≠ location. Country chips cover geographic discovery. |
| **Top Rated section** | Horizontal scroll of top-rated routes | Redundant with Popular filter chip. |
| **Road of the Week rotation** | `featured_tag` stamping, cron job, dedicated resolver | Only needed when there are 50+ MotoVault Picks requiring rotation. Current approach (first pick by rating) suffices. |
| **Route counts by country** | Server-side aggregation for chip badges | Not blocking — chips work without counts. |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-04-15-discovery-personality-brainstorm.md](../brainstorms/2026-04-15-discovery-personality-brainstorm.md) — Key decisions: keep FlatList pattern, use existing API filters for chips, port web typeahead from day one. Curation over completeness.

### Internal References

- Existing Discover tab: `apps/mobile/src/app/(tabs)/(discover)/index.tsx` (772 lines → ~400 after refactor)
- Route detail modal: `apps/mobile/src/app/(modals)/route-detail.tsx`
- Web typeahead: `apps/web/src/graphql/queries/search-typeahead.graphql`
- Web explore page (TOP_COUNTRIES): `apps/web/src/app/explore/page.tsx:18-31`
- Routes service: `apps/api/src/modules/routes/routes.service.ts`
- Filter input DTO: `apps/api/src/modules/routes/dto/discover-routes-filter.input.ts`
- Design system palette: `packages/design-system/src/palette.ts`
- Query keys: `apps/mobile/src/lib/query-keys.ts`
- Query client defaults: `apps/mobile/src/lib/query-client.ts`

### Institutional Learnings

- TanStack Query cache collision: `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`
- GraphQL contract drift: `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`
- oklch colors in RN: `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md`
- Typeahead pg_trgm bug: `docs/solutions/runtime-errors/typeahead-word-similarity-not-found.md`
- Reanimated patterns: `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`

### Review Agent Findings

- **Performance Oracle**: Remove polyline from list queries (P0). Defer below-fold sections. Cap animation delay. Use horizontal FlatList for 6+ items.
- **Architecture Strategist**: Namespace query keys. Set per-section staleTime. Drop client-side text filter. Extract FilterChipBar.
- **Code Simplicity Reviewer**: Cut scope 40%. 6 components → 3. No new resolver. Defer trip planner.
- **Frontend Races Reviewer**: Consolidate filter state. Dismiss typeahead on chip toggle. setInterval leaks on unmount (deferred). Map height animation causes layout jank (deferred).
- **TypeScript Reviewer**: Remove `isDark` prop. Extract `SupportedCountryCode`. `select('*')` misses join (N/A — no new resolver).
- **Security Sentinel**: No new security concerns after cutting Road of the Week resolver. Add `regionCode` format validation.
- **Pattern Recognition**: One `HorizontalRouteSection`, one `FilterChipRow`. Use "route" not "road". Extract inline code.
- **Accessibility Research**: Concrete props for every element. `radiogroup` for exclusive chips. Hide emoji from a11y. Announce typeahead results.
