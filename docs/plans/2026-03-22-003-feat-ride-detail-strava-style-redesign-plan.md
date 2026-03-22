---
title: "feat: Redesign ride detail page with full-screen map, bottom sheet & stat charts"
type: feat
status: completed
date: 2026-03-22
deepened: 2026-03-22
---

# feat: Redesign ride detail page with full-screen map, bottom sheet & stat charts

## Enhancement Summary

**Deepened on:** 2026-03-22
**Research agents used:** framework-docs (bottom-sheet, gifted-charts), expo-patterns, architecture-strategist, performance-oracle, security-sentinel, learnings-researcher

### Key Improvements from Research
1. **Reduced default downsampling to 300 points** (from 500) — gifted-charts performance degrades above 300 points with `isAnimated`
2. **Added `BottomSheetScrollView`** requirement — regular ScrollView breaks gesture handling inside @gorhom/bottom-sheet
3. **Clamp `maxPoints` server-side to 1000** with Zod validation — prevents abuse
4. **Added `enabled` flag** to waypoints query — only fetch after ride data loads (prevents waterfall)
5. **Added IDOR prevention note** — verify ride ownership before returning waypoints (RLS handles this but document explicitly)
6. **Added GraphQL contract drift prevention** — run `pnpm generate` BEFORE mobile work, not just after

### New Considerations Discovered
- Bottom sheet `index={-1}` (closed state) requires `enablePanDownToClose` — use `onChange` to track
- gifted-charts `areaChart` prop enables area fill; `startFillColor`/`endFillColor` for gradient
- `curved` prop smooths noisy GPS speed data significantly
- Need `BottomSheetBackdrop` for dimming map when sheet is expanded
- Constants for waypoint limits should go in `config/constants.ts` (per Redis hardening learning)

---

## Overview

Redesign the ride detail screen (`ride-detail.tsx`) from a ScrollView-based layout to a Strava/Garmin Connect-style experience: full-screen map with a draggable bottom sheet overlay containing ride stats, where each stat is tappable to reveal inline charts (speed over time, elevation profile).

## Problem Statement / Motivation

The current ride detail page shows a fixed 340px map with stats in a card below. Users cannot explore the map freely — it's cramped and non-interactive. There's no way to visualize how speed or elevation changed during a ride. Competitors (Strava, Garmin Connect, Komoot) all use a full-screen map + bottom sheet pattern that motorcyclists expect.

## Proposed Solution

### Architecture

```
┌─────────────────────────────┐
│         Full-screen          │
│        MapboxGL Map          │
│    (route polyline +         │
│     start/end markers)       │
│                              │
│  [← Back]    [Map Style] [Share] │  ← floating buttons
│                              │
├──────────── ▬▬▬ ────────────┤  ← bottom sheet handle
│  Ride Name          Delete ↗ │
│  📅 Saturday, March 22       │
│                              │
│  ┌─────────┐  ┌─────────┐   │
│  │Distance │  │Duration │   │  ← tappable stat tiles
│  │ 42.3 km │  │ 1h 23m  │   │
│  └─────────┘  └─────────┘   │
│  ┌─────────┐  ┌─────────┐   │
│  │Avg Speed│  │Max Speed│   │
│  │ 68 km/h │  │ 142 km/h│   │
│  └─────────┘  └─────────┘   │
│  ┌─────────┐                 │
│  │Elevation│                 │
│  │ +312 m  │                 │
│  └─────────┘                 │
│                              │
│  ┌───────────────────────┐   │  ← chart (when stat tapped)
│  │  Speed over Time ───  │   │
│  │  ╱╲  ╱╲╲             │   │
│  │ ╱  ╲╱   ╲───╱╲      │   │
│  │╱          ╲╱    ╲    │   │
│  └───────────────────────┘   │
└─────────────────────────────┘
```

### Bottom Sheet Snap Points

| Snap Point | Height | Content Visible |
|------------|--------|-----------------|
| **Collapsed** | 0% (index -1) | Map-only mode — sheet fully hidden, small pill handle at bottom |
| **Peek** | ~30% | Ride name, date, top 2 stat tiles |
| **Half** | ~55% | All stats visible |
| **Expanded** | ~90% | Stats + active chart |

#### Research Insights: @gorhom/bottom-sheet v5

**Configuration:**
```typescript
const sheetRef = useRef<BottomSheet>(null);
const snapPoints = useMemo(() => ['30%', '55%', '90%'], []);

<BottomSheet
  ref={sheetRef}
  index={0}                        // start at peek
  snapPoints={snapPoints}
  enablePanDownToClose={true}      // allows swipe to index -1 (closed)
  onChange={handleSheetChange}
  backgroundStyle={{ backgroundColor: palette.cardDark }}
  handleIndicatorStyle={{ backgroundColor: palette.neutral500, width: 40 }}
  backdropComponent={renderBackdrop}  // dim map when expanded
>
  <BottomSheetScrollView>           // MUST use this, not regular ScrollView
    {/* sheet content */}
  </BottomSheetScrollView>
</BottomSheet>
```

**Critical: Use `BottomSheetScrollView`** — regular ScrollView/FlatList breaks gesture priority inside the sheet. Import from `@gorhom/bottom-sheet`.

**Re-opening after close:** When `enablePanDownToClose` dismisses the sheet (index becomes -1), re-open with `sheetRef.current?.snapToIndex(0)`. Attach this to a floating pill button rendered when sheet is closed.

**Backdrop:** Use `BottomSheetBackdrop` with `appearsOnIndex={2}` (expanded) and `opacity={0.3}` for subtle map dimming when viewing charts.

### Chart Behavior

- **One chart at a time** — tapping a stat toggles its chart (tap again to close)
- Charts appear below the stats grid inside the bottom sheet
- Bottom sheet auto-snaps to expanded when a chart opens: `sheetRef.current?.snapToIndex(2)`
- Chart height: 200px
- Available charts:
  - **Speed** (avg or max speed stat tap) → speed (km/h or mph) over elapsed time
  - **Elevation** (elevation stat tap) → altitude over cumulative distance
- Charts are view-only (no map scrubbing in v1)

#### Research Insights: Chart Rendering

**Use `curved` prop** — GPS speed data is inherently noisy. `curved={true}` applies Bezier smoothing that makes the chart readable without pre-processing. Critical for speed charts especially.

**Performance ceiling:** gifted-charts LineChart degrades above ~300 points with animations enabled. **Reduce default `maxPoints` to 300** (not 500). With `isAnimated={false}`, can handle 500+ but animation is a key UX element.

### Full-Screen Map Mode

- **Enter**: Swipe sheet fully down (past peek) OR tap the map area
- **Exit**: Swipe up from bottom edge — small floating pill button at bottom triggers `sheetRef.current?.snapToIndex(0)`
- Android back button: exits full-screen map mode first, then navigates back

**Implementation:**
```typescript
const [isMapFullScreen, setIsMapFullScreen] = useState(false);

const handleSheetChange = useCallback((index: number) => {
  setIsMapFullScreen(index === -1);
}, []);

// Handle Android back
useEffect(() => {
  const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
    if (isMapFullScreen) {
      sheetRef.current?.snapToIndex(0);
      return true; // prevent default back
    }
    return false; // let router handle
  });
  return () => backHandler.remove();
}, [isMapFullScreen]);
```

## Technical Approach

### Phase 1: API — Expose Ride Waypoints

**New files:**
- `apps/api/src/modules/rides/models/waypoint.model.ts` — `@ObjectType()` Waypoint
- `apps/mobile/src/graphql/queries/get-ride-waypoints.graphql`

**Modified files:**
- `apps/api/src/modules/rides/rides.resolver.ts` — add `rideWaypoints` query
- `apps/api/src/modules/rides/rides.service.ts` — add `findWaypoints` method
- `apps/api/src/config/constants.ts` — add waypoint query limits

**Query design:**
```graphql
query GetRideWaypoints($rideId: String!, $maxPoints: Int) {
  rideWaypoints(rideId: $rideId, maxPoints: $maxPoints) {
    recordedAt
    latitude
    longitude
    altitude
    speedMps
    accuracy
  }
}
```

**Server-side downsampling:**
- Accept `maxPoints` argument (default: 300, max: 1000)
- **Clamp `maxPoints` server-side** with `Math.min(input.maxPoints ?? 300, 1000)` — never trust client value
- Add limits to `config/constants.ts`: `WAYPOINT_QUERY_DEFAULT: 300`, `WAYPOINT_QUERY_MAX: 1000`
- Fetch all waypoints ordered by `recorded_at ASC`
- Filter out waypoints with `accuracy > 100` meters before downsampling
- If count > maxPoints, downsample using interval sampling: `Math.floor(total / maxPoints)` step size, always keeping first and last points
- Return camelCase mapped results

**Why server-side downsampling:** A 10k waypoint ride = ~2MB JSON payload. Downsampled to 300 points = ~60KB. 33x reduction with no perceptible loss of chart fidelity.

#### Research Insights: API Security

**Authorization:** RLS on `ride_waypoints` SELECT policy already verifies ride ownership via join to `rides` table. The `SUPABASE_USER` client enforces this. No additional check needed in the service, but document the dependency explicitly.

**Input validation:** Add Zod validation for `maxPoints`:
```typescript
const GetRideWaypointsArgsSchema = z.object({
  rideId: z.string().uuid(),
  maxPoints: z.number().int().min(10).max(1000).optional(),
});
```

**Rate limiting:** The waypoint query is heavier than a simple ride fetch. Apply stricter throttle: `@Throttle({ default: { ttl: 60_000, limit: 30 } })` (30 req/min vs default 100).

**Privacy:** Waypoints contain precise GPS coordinates. The `isPublic` flag on rides should gate waypoint access for any future sharing features. For now, only the ride owner can fetch waypoints (RLS enforced).

#### Research Insights: GraphQL Contract Drift Prevention

Per `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`:
1. **Write the resolver + `.graphql` query file together in Phase 1**
2. **Run `pnpm generate` immediately** after Phase 1, before starting mobile work
3. Commit generated types so mobile work builds against real types
4. Use `String!` for rideId (not `ID!`) — Supabase UUIDs are `String!` in this codebase

### Phase 2: Mobile — Install Bottom Sheet

**New dependency:**
- `@gorhom/bottom-sheet` v5 — peer deps already present (react-native-gesture-handler 2.28.0, react-native-reanimated 4.1.6)

**Installation:**
```bash
pnpm --filter mobile add @gorhom/bottom-sheet@^5
```

#### Research Insights: Bottom Sheet Setup

**GestureHandlerRootView:** The app root (`_layout.tsx`) must be wrapped in `GestureHandlerRootView` for bottom-sheet to work. Check if this already exists (it should, since gesture-handler is installed).

**No conflict with MapboxGL:** @gorhom/bottom-sheet renders above the map in the z-order. The sheet intercepts gestures in its area; the map handles gestures in exposed areas. No `simultaneousHandlers` needed. Verified pattern in Strava-like apps.

### Phase 3: Mobile — Redesign ride-detail.tsx

**Full rewrite** of `apps/mobile/src/app/(modals)/ride-detail.tsx`:

1. **Layout**: `View { flex: 1 }` with full-screen MapboxGL + `BottomSheet` overlay
2. **Presentation change**: Switch from `formSheet` to `fullScreenModal` in `_layout.tsx` (map needs full screen)
3. **Map**: Same Mapbox setup (route polyline, start/end markers, style cycling) but fills entire screen
4. **Floating controls**: Back, map style, share — positioned absolutely over map (same 44x44 pill buttons)
5. **Bottom sheet**: `@gorhom/bottom-sheet` with `snapPoints={['30%', '55%', '90%']}` + `enablePanDownToClose`
6. **Sheet content**: Use `BottomSheetScrollView` (NOT regular ScrollView)
7. **Stats grid**: Same 2-column layout, but each tile is now a `Pressable` with `accessibilityRole="button"`
8. **Active chart state**: `useState<'speed' | 'elevation' | null>(null)` — toggled by stat tap
9. **Waypoint fetch**: Separate `useQuery` with `queryKeys.rides.waypoints(rideId)`, `enabled: !!ride` (wait for ride data)
10. **Preserve**: Share, delete, map style cycling features

**Gesture handling:**
- `BottomSheet` prop `enablePanDownToClose={true}` for map-only mode
- `onChange` callback tracks sheet index, updates `isMapFullScreen` state
- When sheet is closed (index -1), render floating pill button to re-open
- `BackHandler` intercept for Android back button

**Key patterns to follow (from institutional learnings):**
- Use `palette.*` for all colors (never oklch `colors.*`)
- Use `rgba(15,23,42,0)` not `'transparent'` for gradient ends
- Override gifted-charts default fonts (Comic Sans MS → Plus Jakarta Sans)
- Different query keys for ride metadata vs waypoints (avoid TanStack cache collision)
- Use `ride-formatters.ts` for all unit formatting
- `borderCurve: 'continuous'` on all rounded elements
- Animations under 300ms
- Haptic feedback only in the UI component handling the tap (not in state management)
- Use `store.getState()` inside `useEffect` to read Zustand state without re-render subscription

#### Research Insights: Performance

**Parallel data fetching:** Both `useQuery` hooks (ride metadata + waypoints) should fire in parallel. Set `enabled: !!rideId` on both (not `enabled: !!ride` which creates a waterfall). The ride query is fast; waypoints can load independently.

```typescript
// Both fire simultaneously when rideId is available
const { data: rideData } = useQuery({
  queryKey: queryKeys.rides.detail(rideId),
  queryFn: () => gqlFetcher(GetRideDocument, { id: rideId }),
  enabled: !!rideId,
});

const { data: waypointData, isLoading: waypointsLoading } = useQuery({
  queryKey: queryKeys.rides.waypoints(rideId),
  queryFn: () => gqlFetcher(GetRideWaypointsDocument, { rideId, maxPoints: 300 }),
  enabled: !!rideId,
  staleTime: Infinity,  // waypoints don't change for completed rides
});
```

**`staleTime: Infinity`** for waypoints — completed ride data never changes. Prevents refetches on window focus or reconnect.

**Memoize chart data prep:** Haversine calculations for 300 points are ~2ms but should still be in `useMemo` to avoid recalculation on re-renders from bottom sheet animations.

**Lazy mount charts:** Don't render chart components until stat is tapped. Use conditional rendering, not `display: 'none'`. This avoids the cost of gifted-charts measuring/rendering on initial load.

### Phase 4: Mobile — Chart Components

**New files:**
- `apps/mobile/src/components/ride/ride-speed-chart.tsx`
- `apps/mobile/src/components/ride/ride-elevation-chart.tsx`

**Chart implementation using `react-native-gifted-charts` LineChart:**

#### Research Insights: gifted-charts LineChart API

**Key props for area-filled line charts:**
```typescript
<LineChart
  areaChart                          // enables area fill under line
  curved                             // Bezier smoothing — critical for GPS data
  data={chartData}
  height={180}
  width={screenWidth - 72}           // account for sheet padding + axis
  spacing={(screenWidth - 72) / Math.min(chartData.length, 50)}  // auto-space
  initialSpacing={0}
  endSpacing={0}
  hideDataPoints                     // too many points for dots
  thickness={2}
  color={palette.accent500}
  startFillColor={palette.accentTint}
  endFillColor="rgba(45,158,120,0)"  // fade to transparent (NOT 'transparent')
  startOpacity={0.4}
  endOpacity={0}
  isAnimated
  animationDuration={300}
  noOfSections={4}
  rulesColor={palette.surfaceElevated}
  rulesType="dashed"
  yAxisTextStyle={{ fontFamily: 'PlusJakartaSans-Regular', color: palette.neutral500, fontSize: 10 }}
  xAxisLabelTextStyle={{ fontFamily: 'PlusJakartaSans-Regular', color: palette.neutral500, fontSize: 10 }}
  yAxisColor="transparent"
  xAxisColor={palette.surfaceElevated}
  backgroundColor="transparent"
  hideRules={false}
  xAxisLabelTexts={xLabels}          // pre-computed label array
  xAxisLabelTextStyle={{ fontSize: 9, color: palette.neutral500 }}
  labelWidth={40}
  xAxisLabelsVerticalShift={2}
/>
```

**X-axis label strategy:** Don't label every point (300 labels = unreadable). Compute ~5-6 evenly spaced labels:
```typescript
const xLabels = useMemo(() => {
  const labels = new Array(chartData.length).fill('');
  const step = Math.floor(chartData.length / 5);
  for (let i = 0; i < chartData.length; i += step) {
    labels[i] = formatLabel(chartData[i]);
  }
  labels[chartData.length - 1] = formatLabel(chartData[chartData.length - 1]);
  return labels;
}, [chartData]);
```

**Speed Chart (`ride-speed-chart.tsx`):**
- X-axis: elapsed time from ride start (minutes)
- Y-axis: speed in user's measurement system (km/h or mph)
- Line color: `palette.accent500`
- Area fill: `palette.accentTint` → `rgba(45,158,120,0)`
- Data prep: map waypoints → `{ value: formatSpeedValue(wp.speedMps, system) }`
- Skip waypoints with `speedMps === null`
- Show "Insufficient data" if < 10 valid speed points
- Use `curved={true}` to smooth noisy GPS speed readings

**Elevation Chart (`ride-elevation-chart.tsx`):**
- X-axis: cumulative distance from start (km or mi)
- Y-axis: altitude in user's measurement system (m or ft)
- Line color: `palette.signature500`
- Area fill: `rgba(212,74,46,0.12)` → `rgba(212,74,46,0)`
- Data prep: compute cumulative haversine distance between consecutive waypoints
- Skip waypoints with `altitude === null`
- Show "Insufficient data" if < 10 valid altitude points

**Common chart wrapper pattern:**
```typescript
// Wrap both charts in a consistent card
<Animated.View entering={FadeInUp.duration(200)}>
  <View style={{
    backgroundColor: palette.surfaceSubtle,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 16,
    borderWidth: 1,
    borderColor: palette.surfaceElevated,
  }}>
    <Text style={{ fontSize: 13, fontWeight: '600', color: palette.neutral400, marginBottom: 12 }}>
      {chartTitle}
    </Text>
    <LineChart ... />
  </View>
</Animated.View>
```

### Phase 5: Run `pnpm generate`

**Run TWICE during implementation:**

1. **After Phase 1** (API changes): `pnpm generate` — commit generated types. This ensures mobile code builds against real types, preventing GraphQL contract drift.
2. **After Phase 3** (new `.graphql` query file): `pnpm generate` — regenerate client types for the new `GetRideWaypoints` query.

Per `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md`, this is the #1 cause of integration bugs when agents work on API + mobile in parallel.

## Edge Cases & Error Handling

| Case | Handling |
|------|----------|
| No route polyline | Map shows "No route data" placeholder (existing behavior). Stats still display. |
| 0 waypoints | Charts disabled — stat tiles not tappable, no `accessibilityHint` |
| < 10 valid speed/altitude points | Chart area shows "Insufficient data" message instead of chart |
| All altitude values null | Elevation stat tile not tappable, elevation chart unavailable |
| 10k waypoints | Server downsamples to 300 points before sending |
| Waypoint fetch fails | Stats from ride metadata still show. Chart area shows "Couldn't load chart data" with retry |
| Waypoint fetch loading | Skeleton placeholder in chart area (pulsing `palette.surfaceSubtle` block) |
| Offline | Ride metadata may be cached by TanStack Query. Waypoints show offline error. |
| GPS accuracy > 100m | Filtered out server-side before downsampling |
| Recording/paused ride opened | Show current data, but note "Ride in progress" — charts still work with available waypoints |
| `maxPoints` > 1000 from client | Clamped to 1000 server-side |
| Very short ride (< 2 waypoints) | Map shows polyline if available. Charts show "Insufficient data". |
| Sheet at index -1 + Android back | Re-opens sheet first, second back navigates away |

## Acceptance Criteria

### Functional
- [x] Full-screen Mapbox map showing route polyline with start/end markers
- [x] Draggable bottom sheet with 3 snap points + pan-down-to-close (peek, half, expanded + closed)
- [x] Ride name, date, and stats grid visible in bottom sheet
- [x] Each stat tile is tappable (with haptic feedback on iOS)
- [x] Tapping speed stats shows speed-over-time line chart
- [x] Tapping elevation stat shows elevation-over-distance line chart
- [x] Tapping active chart's stat again dismisses the chart
- [x] Swiping sheet fully down enters map-only mode
- [x] Floating pill button to re-open sheet from map-only mode
- [x] Android back button exits map-only mode before navigating back
- [x] Share, delete, and map style cycling preserved
- [x] Charts respect user's measurement system (metric/imperial)
- [x] Server-side waypoint downsampling (max 300 points default, 1000 cap)
- [x] `pnpm generate` run after API changes and after new .graphql file

### Non-Functional
- [ ] Waypoint API response < 60KB for 300 downsampled points
- [ ] Chart renders in < 200ms on mid-range device
- [ ] Bottom sheet animations at 60fps
- [ ] All colors from `palette.*` tokens
- [ ] `borderCurve: 'continuous'` on all rounded elements
- [ ] Animations under 300ms
- [ ] `accessibilityRole="button"` on tappable stat tiles
- [ ] `accessibilityLabel` on chart containers with data summary
- [ ] `staleTime: Infinity` on waypoint query (data never changes for completed rides)
- [ ] Waypoint limits in `config/constants.ts` (not hardcoded)

## Files to Create

| File | Purpose |
|------|---------|
| `apps/api/src/modules/rides/models/waypoint.model.ts` | GraphQL Waypoint ObjectType |
| `apps/mobile/src/graphql/queries/get-ride-waypoints.graphql` | Waypoint fetch query |
| `apps/mobile/src/components/ride/ride-speed-chart.tsx` | Speed over time chart |
| `apps/mobile/src/components/ride/ride-elevation-chart.tsx` | Elevation over distance chart |

## Files to Modify

| File | Changes |
|------|---------|
| `apps/api/src/modules/rides/rides.resolver.ts` | Add `rideWaypoints` query with @Throttle |
| `apps/api/src/modules/rides/rides.service.ts` | Add `findWaypoints` method with downsampling |
| `apps/api/src/config/constants.ts` | Add `WAYPOINT_QUERY_DEFAULT`, `WAYPOINT_QUERY_MAX` |
| `apps/mobile/src/app/(modals)/ride-detail.tsx` | Full rewrite: full-screen map + bottom sheet |
| `apps/mobile/src/app/(modals)/_layout.tsx` | Change ride-detail presentation to fullScreenModal |
| `apps/mobile/package.json` | Add `@gorhom/bottom-sheet` dependency |
| `apps/mobile/src/lib/query-keys.ts` | Add `rides.waypoints(rideId)` key |
| `packages/types/src/validators/ride.ts` | Add Waypoint output schema (for API validation) |

## Out of Scope (v1)

- Chart-to-map scrubbing (highlight map position when scrubbing chart)
- Lean angle chart (data exists but not in spec)
- Weather display on ride detail
- Inline ride name editing
- Waypoint-based map rendering (continue using encoded polyline)
- Multiple charts visible simultaneously

## Sources & References

### Internal
- Current ride detail: `apps/mobile/src/app/(modals)/ride-detail.tsx`
- Chart patterns: `apps/mobile/src/components/expense-dashboard/monthly-trend.tsx`
- Ride formatters: `apps/mobile/src/utils/ride-formatters.ts`
- Waypoints table: `supabase/migrations/00047_create_rides_table.sql`
- Palette tokens: `packages/design-system/src/palette.ts`
- Ride API: `apps/api/src/modules/rides/rides.service.ts`
- Constants: `apps/api/src/config/constants.ts`

### Institutional Learnings
- `docs/solutions/integration-issues/expense-dashboard-server-aggregation-charting.md` — gifted-charts patterns, font override, hooks ordering
- `docs/solutions/architecture/measurement-system-and-ride-feature-design.md` — TanStack Query cache collision bug, formatter usage
- `docs/solutions/ui-bugs/diagnosis-flow-v2-review-findings.md` — `rgba(r,g,b,0)` for gradient transparency, haptics ownership
- `docs/solutions/ui-bugs/sf-symbols-to-lucide-migration-oklch-runtime-bug.md` — never use oklch in RN styles
- `docs/solutions/integration-issues/parallel-agent-graphql-contract-drift.md` — run codegen before parallel work
- `docs/solutions/runtime-errors/redis-backed-infra-and-backend-hardening.md` — centralize constants in config/constants.ts
- `docs/solutions/security-issues/expense-rls-idor-motorcycle-ownership.md` — verify resource ownership in RLS policies
