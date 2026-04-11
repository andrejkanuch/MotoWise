# Implementation Plan: Rides, Group Rides & Trip Planner v2

**PRD Reference:** Trip Planner v2 + Feature Differentiation
**Date:** 2026-04-09
**Scope:** Phase 1 (P0 only) — MVP

---

## Current State Summary

### Group Rides
- **Bug confirmed:** `create-group-ride.tsx:78-79` hardcodes `meetingPointLat: 0, meetingPointLng: 0`
- Meeting point is a plain text field (name only), no geocoding
- Date picker already fixed (this session)
- RLS cancel bug already fixed (this session, migration 00074)
- Detail screen shows meeting point on map but coords are always 0,0

### Trip Planner
- Waypoints added ONLY via map long-press — no text search
- No `day_index` column in `trip_waypoints` table
- No segment distance/time calculation
- No day-by-day grouping in UI
- Date pickers already fixed (this session)
- Trip detail shows flat waypoint list, no day structure

### Shared
- Discover tab shows both GroupRideSection and TripSection but no type labels/badges
- No visual differentiation between Group Ride and Trip cards

---

## Phase 1 Work Items (P0)

### Track A: Database & API (sequential — must complete first)

#### A1. Migration: Add `day_index` to trip_waypoints
- New migration `00075_trip_waypoint_day_index.sql`
- `ALTER TABLE trip_waypoints ADD COLUMN day_index INT NOT NULL DEFAULT 0`
- Run `pnpm generate:types` after push

#### A2. Update Zod schemas + NestJS models
- Add `dayIndex` to `CreateWaypointInput`, `UpdateWaypointInput` schemas in `packages/types`
- Add `dayIndex` field to NestJS `TripWaypoint` model + DTOs
- Add `TripDay` computed type to GraphQL schema (group waypoints by dayIndex)
- Run `pnpm generate` to regenerate

#### A3. Mapbox geocoding utility module
- New file: `apps/mobile/src/utils/mapbox-geocoding.ts`
- Functions: `searchPlaces(query, proximity, limit)` → calls Mapbox Geocoding REST API v5
- Uses `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (already in env)
- Returns typed `GeocodingResult[]` with `name, address, lat, lng, category`
- 300ms debounce helper
- Cache last 20 searches in MMKV

#### A4. Mapbox directions utility module
- New file: `apps/mobile/src/utils/mapbox-directions.ts`
- Function: `getRouteSegments(coordinates[])` → calls Mapbox Directions API v5
- Returns `{ legs: { distance_m, duration_s }[] }` for each segment
- Max 25 waypoints per call (batch if needed)
- 800ms debounce for recalculation during editing

### Track B: Group Ride Meeting Point Fix (can parallel with A)

#### B1. Map picker component for meeting point
- New reusable component: `apps/mobile/src/components/map-picker.tsx`
- Full-width Mapbox map with a draggable center pin
- Geocoding search bar at top (uses A3 utility)
- Returns `{ lat, lng, name }` on confirm
- Used in both Group Ride creation and potentially Trip creation

#### B2. Fix create-group-ride.tsx
- Replace text input for meeting point with MapPicker component
- Wire selected coordinates to `meetingPointLat` / `meetingPointLng` (currently hardcoded 0,0)
- Add validation: block submit if no meeting point selected
- Keep `meetingPointName` populated from geocoding result or manual entry

#### B3. Fix group-ride-detail.tsx meeting point display
- Show actual pin on map at meeting point coordinates
- Add "Get Directions" button that opens native maps app

### Track C: Trip Planner v2 — Text Search + Day Itinerary

#### C1. Geocoding search bar component
- New component: `apps/mobile/src/components/geocoding-search-bar.tsx`
- Text input with autocomplete dropdown
- Uses A3 utility for suggestions
- Displays: place name, category, distance from viewport center
- Selecting a result fires `onSelect({ name, lat, lng, category })`

#### C2. Rewrite create-trip.tsx — Split view with search
- Top half: Mapbox map (existing, keep)
- Bottom half: BottomSheet with search bar + stop list
- Search bar at top of BottomSheet (C1 component)
- Adding a search result → creates waypoint + drops pin
- Long-press on map still works as secondary input
- Stop cards show: icon (by type) + name + notes

#### C3. Segment distance/time on stop cards
- After each stop add/remove/reorder, call Mapbox Directions (A4)
- Display distance and estimated time between consecutive stops
- First stop: "Start" badge; last stop: cumulative totals
- Debounce recalculation 800ms after last edit

#### C4. Day-by-day grouping
- Compute number of days from startDate/endDate
- Group waypoints by `dayIndex` with section headers
- Day header: "Day N — {date}" + total distance + total time
- Color-code: green (<4h), amber (4-6h), red (>6h)
- Default distribution: spread stops evenly across days
- "Move to Day X" action on each stop card

#### C5. Drag-and-drop reordering
- Install `react-native-draggable-flatlist`
- Enable long-press drag to reorder stops within a day
- Up/down arrow buttons as accessible alternative
- Recalculate route after reorder
- Undo toast (5s) after reorder

#### C6. Swipe-to-delete stops
- Swipe left reveals red Delete button
- Undo toast after deletion
- Route recalculates

### Track D: Feature Differentiation UI

#### D1. Type badges on discovery cards
- Add "Group Ride" badge (orange/copper) to group-ride-section cards
- Add "Trip" badge (indigo/blue) to trip-section cards
- Different icon treatment (Users icon vs Map icon)

#### D2. Creation flow entry point differentiation
- On Discover fab/create button, show choice sheet:
  - "Group Ride — Meet up and ride together from one location"
  - "Trip — Plan a multi-day route with stops"
- Route to appropriate creation screen

#### D3. Update trip-detail.tsx for day view
- Show day-by-day itinerary sections (not flat list)
- Each stop shows type icon, name, notes, distance/time from previous
- Day headers with totals
- "Open in Maps" button for multi-stop navigation

---

## Dependency Graph

```
A1 (migration) → A2 (schemas/models) → pnpm generate
A3 (geocoding util) ← standalone
A4 (directions util) ← standalone

B1 (map picker) ← A3
B2 (fix group ride) ← B1
B3 (fix detail) ← standalone

C1 (search bar) ← A3
C2 (rewrite create-trip) ← C1, A2
C3 (segment detail) ← A4, C2
C4 (day grouping) ← A2, C2
C5 (drag-drop) ← C2
C6 (swipe-delete) ← C2

D1 (type badges) ← standalone
D2 (creation entry) ← standalone
D3 (trip detail) ← A2, C3
```

## Recommended Build Order

**Sprint 1 (foundation):**
1. A1 + A2 (DB migration + schema updates)
2. A3 + A4 (Mapbox utilities — parallel)
3. B1 (MapPicker component)
4. D1 + D2 (differentiation UI — parallel, lightweight)

**Sprint 2 (Group Ride fix + Trip search):**
5. B2 + B3 (Group Ride meeting point fix)
6. C1 (geocoding search bar)
7. C2 (rewrite create-trip with search)

**Sprint 3 (Trip planner features):**
8. C3 (segment distances)
9. C4 (day-by-day grouping)
10. C5 + C6 (drag-drop + swipe-delete)
11. D3 (trip detail day view)

---

## New Dependencies Needed
- `react-native-reanimated-dnd` — drag-and-drop built for Reanimated v4 (NOT draggable-flatlist, incompatible with v4)
- `ReanimatedSwipeable` from gesture-handler — already installed, use for swipe-to-delete
- No new Mapbox dependencies — using REST APIs directly with fetch()

## API Details
- **Geocoding:** `GET https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json` — params: types, proximity, limit, language
- **Directions:** `GET https://api.mapbox.com/directions/v5/mapbox/driving/{coords}` — coords as semicolon-separated lng,lat pairs, max 25 waypoints
- **Directions response:** `routes[0].legs[]` each has `distance` (meters) and `duration` (seconds)
- **Free tier:** 100K geocoding + 100K directions requests/month

## Files to Create (estimated)
- `supabase/migrations/00075_trip_waypoint_day_index.sql`
- `apps/mobile/src/utils/mapbox-geocoding.ts`
- `apps/mobile/src/utils/mapbox-directions.ts`
- `apps/mobile/src/components/map-picker.tsx`
- `apps/mobile/src/components/geocoding-search-bar.tsx`

## Files to Modify (major)
- `packages/types/src/validators/trip.ts` — add dayIndex
- `apps/api/src/modules/trips/` — models, DTOs, service, resolver
- `apps/mobile/src/app/(modals)/create-group-ride.tsx` — MapPicker integration
- `apps/mobile/src/app/(modals)/create-trip.tsx` — full rewrite
- `apps/mobile/src/app/(modals)/group-ride-detail.tsx` — meeting point display
- `apps/mobile/src/app/(modals)/trip-detail.tsx` — day-by-day view
- `apps/mobile/src/components/discover/group-ride-section.tsx` — type badge
- `apps/mobile/src/components/discover/trip-section.tsx` — type badge
- `apps/mobile/src/app/(tabs)/(discover)/index.tsx` — creation entry point
- `packages/graphql/` — regenerated after schema changes
