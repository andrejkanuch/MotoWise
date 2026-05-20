# Explore Redesign — Implementation Plan

**Date**: 2026-05-06
**Branch**: `feat/explore-monetization-backend` (continue)
**Source**: Hi-fi React + Mapbox prototype in `~/Downloads/Moto vault/discover-redesign/`

---

## Overview

Replace the current `/explore` landing and `/explore/[country]` results pages with the editorial redesign from the prototype. Four routes, all server-rendered with client islands for interactivity (map, filters, typeahead).

### Routes

| Route | Component | Status |
|-------|-----------|--------|
| `/explore` | Landing (HeroBold + PopularStrip + EditorsLedger + CountryLedger + AppPromo) | **Rewrite** |
| `/explore/[country]` | ResultsDesktop (split-pane list + Mapbox map) | **Rewrite** |
| `/explore/[country]/[region]` | ResultsDesktop with region scope (same component) | **Rewrite** |
| `/explore/[country]` (mobile) | ResultsMobile (list/map toggle) | **New** |

---

## Phase 1: Design Tokens & Primitives

### 1A. Extend CSS tokens

**File**: `apps/web/src/app/globals.css` (add to `:root` or new `explore-tokens.css`)

Add the OKLCH token layer from the prototype. The existing `--mv-*` tokens are close but the redesign uses a slightly different scale (`--bg`, `--surface`, `--line`, `--ink-*`, `--warm-*`). Map these to the existing `--mv-*` namespace to avoid breaking other pages:

```css
/* Explore redesign tokens — OKLCH */
--mv-bg:        oklch(0.08 0.008 55);
--mv-bg-2:      oklch(0.10 0.009 55);
--mv-surface:   oklch(0.13 0.011 55);   /* already exists, verify match */
--mv-surface-2: oklch(0.16 0.012 55);
--mv-line:      oklch(1 0 0 / 0.07);    /* already exists, verify */
--mv-line-2:    oklch(1 0 0 / 0.04);
--mv-ink:       oklch(0.96 0.005 60);
--mv-ink-2:     oklch(0.78 0.012 60);
--mv-ink-3:     oklch(0.6  0.012 60);
--mv-ink-4:     oklch(0.42 0.012 60);
--mv-warm-300:  oklch(0.92 0.10 68);
--mv-warm-400:  oklch(0.86 0.13 68);
--mv-warm-500:  oklch(0.78 0.16 60);
--mv-warm-600:  oklch(0.66 0.17 50);
```

**Risk**: Verify existing `--mv-*` tokens in `packages/design-system/src/tokens.css` match or extend. Don't break existing pages.

### 1B. Fonts

Already loaded in layout:
- `Geist` (body) — via `geist` npm package
- `Instrument Serif` (italic accents) — loaded in `explore/layout.tsx`
- `Geist Mono` — via `geist` npm package

**Action**: Verify Geist + Geist Mono weights (300-700, 400-600) are available. The prototype uses weight 300 (light) for body which may not be loaded yet.

### 1C. Shared primitives

**File**: `apps/web/src/components/explore/primitives.tsx`

Port from prototype's `primitives.jsx`:
- `MonoLabel` — mono uppercase label
- `Icon` — inline SVG icon set (search, arrow-right, chevron-down, sliders, close, map, list, pin, distance, elev, time, bookmark, check, globe)
- `Flag` — stylized country code monogram (gradient swatch)
- `Difficulty` — dot indicator + label
- `Stars` — partial-fill star rating
- `Typeahead` — search dropdown (wire to existing `searchTypeahead` GraphQL query)

These are server-compatible (no hooks) except Typeahead which needs `'use client'`.

---

## Phase 2: Landing Page Rewrite (`/explore`)

### 2A. HeroBold section

**File**: `apps/web/src/components/explore/hero-bold.tsx`

- Dispatch slug ("No 137 · Atlas of Riders" + "Edition 2026 · Spring")
- Oversized 3-line headline: "Where are you / *riding* / next?"
  - `fontSize: clamp(80px, 11vw, 168px)`, `lineHeight: 0.86`
- Search bar with typeahead — **reuse existing `ExploreSearchBar`** but restyle to match prototype (glassmorphic, `--warm-500` button, "Plot route" label, ⌘K badge)
- Dispatch panel ("This week's dispatch" — stats from API or static)
- Stats strip (4-col: routes, countries, riders, avg rating) — hydrate from `fetchCountries()` aggregation
- Quick chips ("Mountain passes", "Weekend escape", etc.)

**Data**: `fetchCountries()` for totals. Stats panel can be static initially, later hydrate from `/api/explore/dispatch`.

### 2B. PopularStrip section

**File**: `apps/web/src/components/explore/popular-strip.tsx`

- 4-column grid of 4:5 aspect-ratio cards
- Geo-IP detected country (reuse existing `detectCountry()`)
- Label: "Detected · {Country}" + "Popular in your country"
- Each card: gradient background, flag, rank, region, title, distance/time/rating

**Data**: `fetchTopTrips(4, countryCode)` — same as current NearYouSection

### 2C. EditorsLedger section

**File**: `apps/web/src/components/explore/editors-ledger.tsx`

- Header: "Worth crossing a continent for."
- Hero pick (1 large, 600px min-height) + 3 stacked side cards + 2 wide cards
- Use `fetchStaffPicks()` (existing function, just restyle output)

**Data**: `fetchStaffPicks()` — already returns isMotovaultPick trips

### 2D. CountryLedger section

**File**: `apps/web/src/components/explore/country-ledger.tsx`

- Header: "Where riders ride." (Instrument Serif italic)
- 2-column grid, grouped by continent (Europe / Americas / Asia & Pacific / Africa & Middle East)
- Each row: rank · flag · name · bar (relative to max) · route count · arrow
- The continent grouping requires the `continent` field — **need to add `continent` to the browseCountries GraphQL query** or derive from country code mapping

**Data**: `fetchCountries()` — existing, but needs continent field. Option A: add continent to API. Option B: use a local `COUNTRY_TO_CONTINENT` map (simpler, data is static).

**Decision**: Use local map for now (32 countries, static list). Add to `@motovault/types` or keep in component.

### 2E. AppPromo section

**File**: `apps/web/src/components/explore/app-promo.tsx`

- Reuse existing app promotion section but restyle to match prototype
- Two-column: copy + tilted phone mockup with offline cache preview
- CTA buttons: "App Store" / "Google Play"

### 2F. Assemble landing page

**File**: `apps/web/src/app/explore/page.tsx` — **rewrite**

Replace the current sections with:
1. `<HeroBold />`
2. `<PopularStrip />`
3. `<EditorsLedger />`
4. `<CountryLedger />`
5. `<AppPromo />`
6. `<Footer />` (existing)

Preserve: JSON-LD, metadata, revalidation, country detection.

---

## Phase 3: Results Pages (`/explore/[country]` and `/explore/[country]/[region]`)

### 3A. FilterBar component

**File**: `apps/web/src/components/explore/filter-bar.tsx` (`'use client'`)

- Pill chips: Difficulty, Surface, Distance, Duration, Sort
- Active state: amber tint bg + border + text
- Dropdown panels (checkbox lists with counts)
- "Clear all" button when filters active
- URL search params sync (same pattern as current `ExploreFilters`)

### 3B. TripListCard component

**File**: `apps/web/src/components/explore/trip-list-card.tsx`

- Thumb-on-top (16:9 aspect), badge top-left, bookmark top-right, rank pill bottom-left
- Region/title/metrics/difficulty/rating below
- Hover: `translateY(-2px)`
- Focused (from map pin click): amber border + tint
- Props: `trip`, `idx`, `hovered`, `focused`, `onMouseEnter`, `onMouseLeave`
- **Client component** (needs mouse events)

### 3C. MapboxMap component

**File**: `apps/web/src/components/explore/mapbox-map.tsx` (`'use client'`)

- Real Mapbox GL with `dark-v11` style
- Token: `NEXT_PUBLIC_MAPBOX_TOKEN` (from env)
- Numbered amber-bordered circle pins (`.mv-pin`)
- Hover card → pin scales + draws polyline (use `trip.geometry` if available, else synthetic curve)
- Click pin → scroll list to focused card
- Cluster pins (Mapbox GL `cluster: true` on GeoJSON source)
- Navigation control (zoom only, no compass)

**Critical**: The prototype uses a public demo token. Production needs `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`. Already documented in CLAUDE.md.

### 3D. ResultsDesktop layout

**File**: `apps/web/src/components/explore/results-desktop.tsx` (`'use client'`)

- `<Topbar>` (existing Navbar)
- `<ResultsHeader>` — breadcrumb + flag + title + count
- `<FilterBar>`
- Grid: `440px 1fr` (list + map)
- List panel: scrollable, `<TripListCard>` stack
- Map panel: `<MapboxMap>`
- State: `hoveredId`, `focusedId` — sync between list and map

### 3E. ResultsMobile layout

**File**: `apps/web/src/components/explore/results-mobile.tsx` (`'use client'`)

- MobileTopbar (back button, breadcrumb, search icon)
- MobileFilterScroll (horizontal scroll pills)
- Two modes: list / map (toggle via sticky bottom pill)
- List mode: vertical card stack + sticky "Show map" pill
- Map mode: fullscreen map + bottom-sheet focused card + sticky "Show list" pill
- Responsive breakpoint: use CSS `@media (max-width: 768px)` or Next.js `useMediaQuery`

### 3F. Assemble results pages

**File**: `apps/web/src/app/explore/[country]/page.tsx` — **rewrite**

- Server component fetches trips + regions
- Passes data to `<ResultsDesktop>` (client) which handles hover/focus state
- Mobile: either conditional render or CSS-only responsive (prefer CSS for SSR)

**File**: `apps/web/src/app/explore/[country]/[region]/page.tsx` — **rewrite**

- Same component, `region` prop scopes the query

**Data**: 
- `fetchTripTemplatesByCountry(countryCode, 50)` — need lat/lng for map pins
- Current `TripTemplate` GraphQL type needs `lat`/`lng` fields (or `startLat`/`startLng`)
- If lat/lng not available, derive from polyline first point

---

## Phase 4: Data & API Gaps

### 4A. Trip coordinates for map pins

The map requires `lat`/`lng` per trip. Check if `TripTemplate` already has coordinates:
- `startLat` / `startLng` fields in the database
- Or extract first coordinate from `polyline` field

If neither exists, add `startLat`/`startLng` to the GraphQL schema.

### 4B. Continent mapping for CountryLedger

Create `apps/web/src/lib/continent-map.ts`:
```ts
export const COUNTRY_CONTINENT: Record<string, string> = {
  IT: 'Europe', FR: 'Europe', CH: 'Europe', /* ... */
  US: 'Americas', CA: 'Americas', /* ... */
  JP: 'Asia & Pacific', /* ... */
  MA: 'Africa & Middle East', /* ... */
};
```

### 4C. Route geometry for hover polylines

If `TripTemplate.geometry` (GeoJSON LineString) is available, use it. Otherwise, synthesize a curve from the pin coordinates (like the prototype does).

---

## Phase 5: Polish & QA

### 5A. Acceptance checklist from handoff

- [ ] OKLCH tokens as CSS custom properties
- [ ] Geist + Instrument Serif (italic) + Geist Mono loaded
- [ ] Hero typography clamps responsively
- [ ] Country ledger groups by continent, sorts by routes desc
- [ ] Hover list card → highlights map pin + draws polyline
- [ ] Click map pin → scrolls list to focused card
- [ ] Mobile: list ↔ map toggle, no scroll-position loss
- [ ] Empty state CTAs work (Clear filters / Browse nearby)
- [ ] Filter chips show active count, badge sums, reset
- [ ] All Geist Mono labels uppercase with 0.12em letter-spacing

### 5B. SEO preservation

- Keep JSON-LD structured data
- Keep `generateMetadata()` with proper OG/Twitter cards
- Keep `revalidate` values
- Keep hreflang alternates
- Keep SEO footer links

### 5C. Performance

- Lazy-load Mapbox GL (dynamic import, no SSR)
- `content-visibility: auto` on below-fold sections (already in globals.css)
- Skeleton states for async sections
- `loading="lazy"` on non-hero images

---

## File Summary

### New files
```
apps/web/src/components/explore/
├── primitives.tsx          (MonoLabel, Icon, Flag, Difficulty, Stars)
├── hero-bold.tsx           (HeroBold section)
├── popular-strip.tsx       (PopularStrip section)
├── editors-ledger.tsx      (EditorsLedger section)
├── country-ledger.tsx      (CountryLedger section)
├── app-promo.tsx           (AppPromo section)
├── filter-bar.tsx          (FilterBar + FilterPill) [client]
├── trip-list-card.tsx      (TripListCard) [client]
├── mapbox-map.tsx          (MapboxMap) [client]
├── results-desktop.tsx     (ResultsDesktop layout) [client]
├── results-mobile.tsx      (ResultsMobile layout) [client]
├── results-header.tsx      (ResultsHeader + breadcrumb)
├── skeleton-card.tsx       (Loading skeleton)
└── empty-state.tsx         (Empty results)

apps/web/src/lib/
└── continent-map.ts        (Country → continent mapping)
```

### Modified files
```
apps/web/src/app/explore/page.tsx              — rewrite landing
apps/web/src/app/explore/[country]/page.tsx    — rewrite results
apps/web/src/app/explore/[country]/[region]/page.tsx — rewrite results
apps/web/src/app/globals.css                   — add OKLCH tokens
```

### Preserved files (no changes)
```
apps/web/src/app/explore/layout.tsx            — keep as-is
apps/web/src/app/explore/search/page.tsx       — keep as-is
apps/web/src/app/explore/loading.tsx           — keep as-is
apps/web/src/components/explore-search-bar.tsx — keep, restyle
```

---

## Execution Order

1. **Tokens + primitives** (Phase 1) — no dependencies, foundation for everything
2. **Landing page components** (Phase 2A-2E) — can be built in parallel
3. **Landing page assembly** (Phase 2F) — depends on 2A-2E
4. **Results components** (Phase 3A-3C) — can be built in parallel  
5. **Results layout** (Phase 3D-3E) — depends on 3A-3C
6. **Results page assembly** (Phase 3F) — depends on 3D-3E
7. **Data gaps** (Phase 4) — can start early, needed by Phase 3
8. **Polish** (Phase 5) — final pass

Estimated: ~18 components, 3 page rewrites, 1 new utility file.
