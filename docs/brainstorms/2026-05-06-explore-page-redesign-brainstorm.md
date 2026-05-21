---
date: 2026-05-06
topic: explore-page-redesign
---

# Explore Page Redesign — Search, Filters & Discovery

## What We're Building

A restructured explore experience that follows the AllTrails pattern: **discovery landing → search/browse by place → filtered results with map**. The current explore page has disconnected search, non-functional filters, fake data, and dead buttons. This redesign unifies the flow into a coherent funnel.

## Reference

AllTrails serves as the primary UX reference:
1. **Landing** (`/explore`) — inspirational hero, search bar, local favorites, app promo, SEO footer
2. **Typeahead** — search "Slovakia" → see places + trails matching
3. **Results** (`/explore?bounds=...`) — full-screen split view: scrollable trip list (left) + Mapbox map (right) + filter bar (top)
4. **Detail** (`/trail/...`) — full route page with overview, conditions, reviews, nearby

## Current Problems

### Search bar + filter pills are disconnected
- Search bar (`ExploreSearchBar`) navigates to `/explore/search` with `q`, `country`, `duration`
- Filter pills (`ExploreFilters`) set `difficulty`, `surface`, `distance`, `sort` on `/explore`
- These two systems never talk — selecting "Moderate" then searching ignores the filter

### Quick chips are keyword hacks
- "Weekend Escape" sets `query = "Loop"`, "Mountain passes" sets `query = "Pass"`
- Doesn't actually filter by route type — just stuffs text into the search input

### "Curated Themes" has hardcoded fake counts
- "2,340 routes", "1,890 routes", "3,120 routes" — all made up
- Links go to `/explore?q=Mountain%20Passes` which doesn't filter anything on the main page

### Map View button does nothing
- `ExploreMapToggle` sets `?view=map` but nothing reads that param or renders a map

### Country grid is artificially limited
- Shows top 12, button says "All 32 countries" but links to `/explore` (same page)

### "Browse the atlas" filters only 24 pre-fetched trips
- Client-side filtering on a tiny subset — useless for real discovery

### NearYou section is confusing
- "Routes near United States" (IP-based) — "near" implies proximity but it's country-scoped
- "View all" links back to the same page

## Chosen Approach

### Page structure

```
/explore                    → Discovery landing (no filters)
/explore/[country]          → Country results — AllTrails-style split view
/explore/[country]/[region] → Region results — same layout, scoped tighter
/trips/[c]/[r]/[slug]       → Trip detail (already exists, solid)
```

### `/explore` — Discovery Landing

**Keep:**
- Hero: "Where are you riding next?" + search typeahead
- Editor's Picks (real data)
- App promotion section
- SEO footer (top routes, regions, countries)

**Change:**
- Search bar becomes navigation-only typeahead (remove Country/Duration dropdowns)
- Country grid shows ALL countries (no artificial 12 cap), grouped by continent or sorted by route count
- "Popular in {country}" section (IP-based) — rename from "Routes near..."
- Remove "Browse the atlas" section with broken filters
- Remove "Curated themes" with fake counts (or wire to real filtered views)
- Remove Map View button
- Remove filter pills from this page entirely

**Add:**
- Curated collections that link to real filtered views (e.g., `/explore?theme=mountain-passes`)

### `/explore/[country]` — AllTrails-style Results

This is the **new core experience**. Split-panel layout:

```
┌─────────────────────────────────────────────────────────────┐
│ Filter bar: Difficulty | Surface | Distance | Duration | Sort│
├────────────────┬────────────────────────────────────────────┤
│ Trip list      │           Mapbox map                       │
│ (scrollable)   │    (route polylines + markers)             │
│                │                                            │
│ Card 1         │    [clustered route pins]                  │
│ Card 2         │                                            │
│ Card 3         │    Hover card → highlight on map           │
│ ...            │    Click pin → scroll to card              │
│                │                                            │
│ [Load more]    │                                            │
└────────────────┴────────────────────────────────────────────┘
```

**Filters (backed by real backend queries):**
- Difficulty: Easy / Moderate / Challenging / Expert
- Surface: Paved / Mixed / Off-road
- Distance: < 50km / 50-100km / 100-300km / 300+
- Duration: Day trip / Weekend / Multi-day
- Sort: Rating / Distance / Newest

**Map features:**
- Route polylines (we have `polyline` in the DB)
- Clustered markers for route start points
- Hover trip card → highlight route on map
- Click map pin → scroll to card in list
- Map bounds sync with URL for shareable links

**Backend:** `DiscoverRoutesFilterInput` already supports `countryCode`, `surfaceTypes`, `lengthRanges`, `bounds`, `sortByRating`. Minor additions needed for difficulty + duration.

### `/explore/[country]/[region]` — Same Layout, Scoped

Identical to country view but map zoomed to region, results filtered by `regionCode`.

### `/explore/search` — REMOVED

Search always navigates into the country/region funnel. Typing "Slovakia" → `/explore/sk`. Typing "Stelvio Pass" → `/trips/it/taa/stelvio-pass`.

## Key Decisions

- **Filters live on country/region pages, NOT the landing page**: Landing is for discovery; filters are for narrowing down once you've picked a place
- **Map is the anchor on results pages**: AllTrails pattern — list + map side by side. This is a big differentiator; we already have polyline data
- **Search is navigation, not filtering**: Typeahead resolves to a place or route, then navigates. No separate search results page
- **All countries visible**: No artificial cap. Group by continent or sort by route count
- **No fake data**: Remove hardcoded route counts from themes. Use real counts or omit

## What's NOT Changing (For Now)

- **Trip detail page** — already solid (hero, stats, day-by-day, reviews, CTAs)
- **Mobile app explore** — separate concern
- **Interactive map on detail page** — enhancement for later (currently static Mapbox image)
- **Conditions/weather on detail** — AllTrails feature, not priority now
- **Nearby trips on detail** — good enhancement but separate scope

## Open Questions

1. **Should the map view be the default on country pages, or should users opt into it?** AllTrails defaults to map. We could default to grid on mobile and map on desktop.
2. **Do we need "move map to search" (re-query as user pans)?** AllTrails does this with bounds in URL. Adds complexity but is very powerful.
3. **How to handle countries with very few routes?** (e.g., 2-3 routes) — still show split view or fallback to simple list?
4. **Should filter pills persist in URL for shareability?** (Yes, almost certainly — AllTrails does this)

## Next Steps

→ `/ce:plan` for implementation details — break into phases:
  - Phase 1: Clean up `/explore` landing (remove broken stuff, fix country grid, simplify search)
  - Phase 2: Build `/explore/[country]` split view with list + filters
  - Phase 3: Add Mapbox interactive map to country/region pages
  - Phase 4: Wire map interactions (hover highlight, click-to-scroll, bounds sync)
