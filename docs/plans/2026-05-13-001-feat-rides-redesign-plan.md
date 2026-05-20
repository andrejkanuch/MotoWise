# Rides Screens Redesign Plan

**Date:** 2026-05-13
**Branch:** feat/onboarding-redesign-v2
**Scope:** 4 screens — My Rides, Ride Detail, Start Ride, HUD

## Design Decisions

From the HTML design file (`Rides Redesign.html`), each section has 3 variants (A, B, C). Selected variants:

| Screen | Variant | Rationale |
|--------|---------|-----------|
| My Rides | **B — Stat tiles + thumbnail cards** | Period switcher, hero stat card with sparkline, 3 stat tiles, filter pills, thumbnail cards with route preview |
| Ride Detail | **A — Map hero + tappable stats** | Full-bleed map hero, bottom sheet, tappable stat tiles that toggle speed/elevation chart, ride notes |
| Start Ride | **A — Compact refined** | Editorial headline, bike picker dropdown, pre-flight checklist, previous rides link, full-width CTA |
| HUD | **A + B switchable** | User requirement: both HUD layouts available, toggle between them. A = speed-hero dark, B = map-first minimal. Each supports light/dark mode toggle. |

## Critical Rule: No Dummy Data

All data must be pulled from real sources (GraphQL queries, ride store, device sensors). If data is unavailable, display **"NA"** so we know what needs backend work.

## Implementation Plan

### Task 1: Redesign My Rides List (`rides.tsx`)

**File:** `apps/mobile/src/app/(tabs)/(profile)/rides.tsx`

Redesign to match Variant B:
- **Header:** Back button + "My rides" title + total ride count pill (warm bg)
- **Period switcher:** Horizontal pill row — Week / Month / Year / All (stored in state, filters stats)
- **Hero stat card:** Large distance number with serif font feel, percentage change badge, SVG sparkline area chart showing daily distances
- **3 stat tiles:** Rides count, Moving time, Max speed — in a 3-column grid with kicker labels
- **Filter pills:** All / Solo / Group (future — show but don't filter yet, NA behavior)
- **Ride cards:** Thumbnail cards with route preview image, ride name, date, duration, distance, avg speed
- Keep existing: pagination, pro upgrade CTA, empty state, pull-to-refresh
- Use editorial theme tokens throughout
- All stats computed from real `allEdges` data via `useRideStats` hook (extend it for period filtering)

### Task 2: Redesign Ride Detail (`ride-detail.tsx`)

**File:** `apps/mobile/src/app/(modals)/ride-detail.tsx`

Redesign to match Variant A:
- **Map hero:** Full-bleed Mapbox map (existing) with floating back/share/map-style buttons
- **Time range pill:** Floating pill on map showing start time → end time with green/red dots
- **Bottom sheet:** Rounded top, drag handle
  - Kicker: date + time
  - Title: Ride name in large editorial serif-like weight
  - Bike info row: bike avatar + name
  - **Stat grid:** 3×2 grid of tappable `StatTile` components. Each tile shows icon, kicker label, serif value, unit. Tiles for speed/elevation are tappable → toggle chart
  - **Chart section:** Speed/Elevation toggle with area chart (reuse existing `RideSpeedChart`/`RideElevationChart`)
  - **Notes section:** Dashed-border text area for ride notes (show "Add notes…" if empty)
- Keep existing: delete button, share, comments for public rides
- All data from existing `GetRideQuery` — no dummy data

### Task 3: Redesign Start Ride (`start-ride.tsx`)

**File:** `apps/mobile/src/app/(modals)/start-ride.tsx`

Redesign to match Variant A:
- **Close button:** Top left, circular
- **Editorial headline:** "Ready to *ride.*" with serif italic on "ride"
- **Status line:** "GPS locked, weather clear, battery 84%" — pull real GPS status, battery level
- **Bike picker:** Card showing selected bike with avatar, year/make/model, mileage. Tap to expand dropdown showing other bikes + "Quick ride · no bike" option
- **Pre-flight checklist:** Card with 4 check items:
  - GPS lock: real from location permissions + accuracy
  - Weather: show "NA" (no weather API yet)
  - Battery: real from `expo-battery`
  - Bike status: real from motorcycle service schedule if available, else "NA"
- **Previous rides link:** Card showing ride count + last ride name/distance/date
- **CTA:** Full-width dark button "Start ride" with green dot + chevron
- **Subtext:** "Tracks GPS, speed and route until you tap end."
- Keep existing: unfinished ride banner, crash recovery logic

### Task 4: Redesign HUD — Dual Layout with Theme Toggle

**File:** `apps/mobile/src/app/(modals)/ride-hud.tsx`

Implement **both** HUD A and HUD B as switchable layouts:

#### Layout A — Speed-Hero Dark
- Top bar: Recording badge + elapsed timer + night/battery toggles
- **Speed hero card:** Massive speed number (124pt), max speed beside it, live sparkline below
- **Map:** Bordered rounded map with bike position pulse, distance pill overlay
- **Stat strip:** 4-column grid — DIST, AVG, GAIN, ALT
- **Controls:** Pause button + Stop circle

#### Layout B — Map-First Minimal
- **Full-bleed map** as background with bike position marker
- **Floating status pill:** REC badge + elapsed timer (centered top)
- **Night toggle:** Top right floating button
- **Floating speed pill:** Dark rounded pill with large speed number, centered above bottom sheet
- **Bottom sheet:** 4-column stat grid + Pause/Stop controls

#### Switching & Theme
- **Layout toggle:** A segmented control or swipe gesture to switch A ↔ B. Store preference in MMKV.
- **Theme toggle:** Each layout supports light mode and dark mode independently. The existing night mode toggle controls this.
- Both layouts use the same real data from `useRideStore` — speed, distance, elapsed, elevation, waypoints, lean angle
- Both layouts keep existing: keep-awake, sparkline data collection, pause/resume, end ride flow

### Task 5: New/Updated Components

- **`StatTile` component** — Reusable stat tile for Ride Detail (icon, kicker, value, unit, active state, onPress)
- Update **`RideCard`** — New thumbnail card layout matching design B (route thumbnail, warm editorial styling)
- **`HudLayoutA`** — Extract Layout A into its own component
- **`HudLayoutB`** — Extract Layout B into its own component
- **`HudLayoutSwitcher`** — Toggle control to switch between A and B
- **`PreFlightChecklist`** — Reusable checklist component for Start Ride

### Task 6: Install expo-battery dependency

Need `expo-battery` for real battery level in Start Ride pre-flight. Check if already installed, install if not.

## Data Sources (No Dummy Data)

| Data Point | Source | Fallback |
|-----------|--------|----------|
| Ride list + stats | `MyRidesDocument` GraphQL query | Empty state |
| Ride detail | `GetRideDocument` / `GetPublicRideDocument` | Loading spinner |
| Waypoints | `GetRideWaypointsDocument` | "Insufficient data" |
| Motorcycles | `MyMotorcyclesDocument` | Quick Ride |
| GPS status | `expo-location` permissions check | "NA" |
| Battery level | `expo-battery` | "NA" |
| Weather | Not available | "NA" |
| Bike service status | Motorcycle service schedule from API | "NA" |
| Live speed/distance | `useRideStore` Zustand store | 0 |
| Route thumbnail | `ride.routeThumbnailUri` | Placeholder icon |

## Files Modified

```
apps/mobile/src/app/(tabs)/(profile)/rides.tsx          — Full redesign
apps/mobile/src/app/(modals)/ride-detail.tsx             — Full redesign
apps/mobile/src/app/(modals)/start-ride.tsx              — Full redesign
apps/mobile/src/app/(modals)/ride-hud.tsx                — Full redesign (dual layout)
apps/mobile/src/components/ride/ride-card.tsx             — Updated card design
apps/mobile/src/components/ride/stat-tile.tsx             — NEW
apps/mobile/src/components/ride/hud-layout-a.tsx          — NEW (extracted)
apps/mobile/src/components/ride/hud-layout-b.tsx          — NEW (extracted)
apps/mobile/src/components/ride/hud-layout-switcher.tsx   — NEW
apps/mobile/src/components/ride/pre-flight-checklist.tsx  — NEW
apps/mobile/src/utils/ride-formatters.ts                  — May add formatters
```

## Conventions

- Editorial theme tokens (`useEditorialTheme`) for all colors
- `borderCurve: 'continuous'` on all rounded elements
- `FadeInUp.delay(index * 50)` for staggered list animations
- Haptic feedback on iOS for interactive moments
- `palette` from `@motovault/design-system` — no hardcoded hex
- All generated types from `@motovault/graphql`
- Inline styles (not StyleSheet.create)
