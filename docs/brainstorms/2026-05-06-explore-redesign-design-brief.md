# Explore Page Redesign — Design Brief

## Context

MotoVault is a motorcycle trip discovery platform (dark theme, premium feel). We're redesigning our `/explore` flow which is currently broken — disconnected search, non-functional filters, dead buttons, fake data. The new flow follows the AllTrails pattern: discovery landing → search by place → filtered results with map.

## Design System (already established)

- **Theme**: Dark — backgrounds in `oklch(0.08–0.15)` range
- **Accent**: Warm amber/gold (`--mv-warm-400`, `--mv-warm-500`)
- **Typography**: Sans-serif body, serif accent for emphasis words, `geist-mono` for labels/metadata
- **Cards**: Rounded corners (`--mv-radius`), subtle borders (`--mv-line`), image backgrounds with gradient overlays
- **Pills/Tags**: Rounded full (`border-radius: 999`), monospace uppercase labels
- **Spacing**: Generous whitespace, max-width container

## Reference

AllTrails (see attached screenshots):
1. Landing page — hero with search, local favorites, app promo
2. Typeahead dropdown — places + trails matching search term
3. Results page — split panel: scrollable list (left) + interactive map (right) + filter bar (top)
4. Detail page — we already have this built, no redesign needed

## What Needs Designing

### Screen 1: `/explore` — Discovery Landing (Desktop + Mobile)

The entry point. Purpose: inspire and navigate riders to a destination.

**Sections top to bottom:**
1. **Hero** — Large heading "Where are you riding next?", subtext with route/country count, search bar (typeahead only — no dropdowns, just a single text input)
2. **Popular in {Country}** — 4 trip cards based on visitor's country (IP detection). Cards already exist, just need layout.
3. **Editor's Picks** — 6 featured trip cards (taller aspect ratio, "Editor's Pick" badge)
4. **Browse by Country** — ALL countries (currently 32), not limited to 12. Need a layout that handles 30+ countries cleanly. Consider: grouped by continent/region, or a dense grid sorted by route count. Each tile shows country name, code badge, route count.
5. **App Promo** — existing section, phone mockup + CTA buttons
6. **SEO Footer** — three columns: Top Routes, Top Regions, Top Countries (text links)

**Key interaction:** Typing in the search bar shows a typeahead dropdown with two groups — "Locations" (countries, regions, cities) and "Routes" (matching trip names). Selecting a location navigates to `/explore/[country]` or `/explore/[country]/[region]`. Selecting a route navigates to the trip detail page. Keyboard navigation (arrow keys, enter, escape).

### Screen 2: `/explore/[country]` — Results Page (Desktop)

This is the most important screen. The AllTrails-style split view.

**Layout:**
- **Filter bar** (full width, top) — horizontal row of filter dropdowns/pills:
  - Difficulty: Easy / Moderate / Challenging / Expert
  - Surface: Paved / Mixed / Off-road  
  - Distance: < 50km / 50-100km / 100-300km / 300+
  - Duration: Day trip / Weekend / Multi-day
  - Sort: Rating / Distance / Newest
  - "Clear all" when any filter is active
- **Left panel** (~400px, scrollable) — trip count + sorted trip cards. Each card: image thumbnail, title, country/region tag, stats row (distance, elevation, time, difficulty, rating). Save/bookmark button.
- **Right panel** (fills remaining width) — Mapbox map showing route polylines and/or start-point markers. When hovering a card in the list, highlight that route on the map. When clicking a map pin, scroll the list to that card.

**States to consider:**
- Loading (skeleton cards + map placeholder)
- No results for current filters ("No routes match — try adjusting filters")
- Few results (< 4 trips — still show map, list doesn't need to scroll)

### Screen 3: `/explore/[country]` — Results Page (Mobile)

On mobile, the split panel doesn't work. Need a mobile-specific layout:
- Default: scrollable list view with filter bar (horizontally scrollable pills)
- Toggle button to switch to full-screen map view
- When in map view: tapping a pin shows a floating card overlay at the bottom (trip preview)
- Tapping the card navigates to the trip detail

### Screen 4: `/explore/[country]/[region]` — Region Results

Same layout as country results but:
- Breadcrumb: Explore → Country → Region
- Map zoomed into the region
- Results scoped to that region

### Component: Trip Card (List Variant)

A horizontal or compact card for use in the results list panel. Different from the existing large image cards on the landing page.

**Contains:**
- Small thumbnail image (left or top)
- Trip title
- Location tag (region, country)
- Stats: distance, elevation gain, estimated time, difficulty badge, rating (stars + count)
- Save/bookmark icon button

### Component: Filter Bar

Horizontal row of filter controls. Each filter is a dropdown pill — click to expand options, click option to select, click again to deselect. Active filters show the selected value with accent color. "Clear all" appears when any filter is active. Must be horizontally scrollable on mobile.

### Component: Map Pin / Cluster

- Single route pin: small dot or custom marker with accent color
- Clustered routes: circle with count ("5 trails" like AllTrails)
- Active/hovered pin: larger, brighter, shows route name tooltip
- Route polyline: drawn on map when zoomed in enough, accent color with slight glow

## What Does NOT Need Designing

- Trip detail page (`/trips/[c]/[r]/[slug]`) — already built and solid
- Navigation/header — existing
- The typeahead search component — mostly built, just needs visual cleanup
- Authentication flows
- Mobile app screens

## Deliverables

Figma frames or high-fidelity mockups for:
1. `/explore` landing — desktop
2. `/explore` landing — mobile
3. `/explore/[country]` results — desktop (with map)
4. `/explore/[country]` results — mobile (list view + map view toggle)
5. Filter bar component (default, active, mobile states)
6. Trip card (list variant)
7. Map interaction states (hover, selected, cluster)
8. Empty/no-results state
