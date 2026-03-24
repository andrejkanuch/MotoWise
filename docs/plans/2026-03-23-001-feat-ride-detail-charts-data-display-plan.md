---
title: "feat: Enhance ride detail with interactive charts and complete data display"
type: feat
status: active
date: 2026-03-23
---

# Enhance Ride Detail with Interactive Charts & Complete Data Display

## Enhancement Summary

**Deepened on:** 2026-03-23
**Sections enhanced:** 6
**Research agents used:** best-practices-researcher, kieran-typescript-reviewer, performance-oracle, julik-frontend-races-reviewer, learnings-researcher

### Key Improvements
1. Full `pointerConfig` API reference with typed callback signature and distance-in-tooltip solution
2. Gesture conflict resolution: BottomSheet vs chart pointer interaction
3. Animation choreography: defer chart mount until sheet snap completes
4. LTTB downsampling as alternative to stride sampling for peak preservation

### Critical Findings from Research
- `hideDataPoints` does NOT conflict with `pointerConfig` — no need to change
- `pointerLabelComponent` receives `(items, secondaryItems, pointerIndex)` — the 3rd arg gives the index
- Current elevation chart STRIPS the `dist` property at line 90 — must preserve for tooltips
- `STAT_CHART_MAP` must be updated to include the new `'Elev. Loss'` label

---

## Overview

The ride detail screen captures rich telemetry (altitude, speed, heading, accuracy, coordinates) but only partially displays it. Charts exist for speed and elevation but lack interactivity and use inconsistent X-axes. This plan adds interactive chart tooltips, aligns both charts to use distance (km) on the X-axis, and surfaces additional ride stats.

## Problem Statement

1. **Speed chart uses time-based X-axis** (elapsed minutes) while elevation chart uses distance (km). The user expects consistency — both should use distance.
2. **No chart interactivity** — users cannot tap/scrub to see exact values at a point on the chart.
3. **Missing stat tiles** — elevation loss is captured but not shown.
4. **Heading not exposed via GraphQL** — stored in DB but `Waypoint` ObjectType doesn't include it.

## Proposed Solution

### Phase 1: Speed Chart X-Axis → Distance (km)

**File:** `apps/mobile/src/components/ride/ride-speed-chart.tsx`

- Port the haversine distance computation from `ride-elevation-chart.tsx` into the speed chart
- Replace elapsed-minutes X-axis labels with distance labels (km or mi based on measurement system)
- Import `distanceUnitLabel` from `ride-formatters.ts`
- Import shared `haversineDistance` from new `geo-utils.ts`

```tsx
// ride-speed-chart.tsx — key change in useMemo
// Replace time-based x-axis with distance-based (same approach as elevation chart)
import { haversineDistance } from '../../utils/geo-utils';

const distDivisor = isImperial ? 1609.34 : 1000;
let cumDist = 0;
const data = sampled.map((wp, i) => {
  if (i > 0) {
    cumDist += haversineDistance(
      sampled[i - 1].latitude, sampled[i - 1].longitude,
      wp.latitude, wp.longitude,
    );
  }
  return {
    value: formatSpeedValue(wp.speedMps ?? 0, system),
    dist: cumDist / distDivisor,
  };
});
```

### Phase 2: Interactive Chart Tooltips

**Files:** `ride-speed-chart.tsx`, `ride-elevation-chart.tsx`

Add `pointerConfig` to both `LineChart` components for crosshair with tooltip.

#### Research Insights

**`pointerLabelComponent` callback signature** (from library source):
```tsx
pointerLabelComponent(
  items,              // Array of data items at the pointer index
  secondaryDataItems, // Array of secondary data items (or [undefined])
  pointerIndex        // The numeric index of the data point — USE THIS
)
```

**Critical: Preserve custom properties on data items.** The library preserves ALL custom properties on data objects. The current elevation chart strips them at line 90:
```tsx
// WRONG — strips dist property needed for tooltip:
chartData: data.map((d) => ({ value: d.value })),

// CORRECT — preserves dist for pointerLabelComponent access:
chartData: data,
```

**`hideDataPoints` is compatible** with `pointerConfig`. They are independent systems — `hideDataPoints` controls static dots on the line, `pointerConfig` renders its own dynamic pointer dot. No change needed.

#### Implementation

```tsx
// Type the tooltip items (library types pointerLabelComponent as bare Function)
interface ChartDataItem {
  value: number;
  dist: number;
}

// Define tooltip styles OUTSIDE the component to avoid re-creation during drag
const TOOLTIP_STYLE = {
  backgroundColor: palette.cardDark,
  borderRadius: 8,
  borderCurve: 'continuous' as const,
  padding: 8,
  borderWidth: 1,
  borderColor: palette.surfaceElevated,
} as const;

const TOOLTIP_VALUE_STYLE = {
  color: palette.white,
  fontSize: 13,
  fontFamily: 'PlusJakartaSans-SemiBold',
  fontVariant: ['tabular-nums'] as const,
} as const;

const TOOLTIP_DIST_STYLE = {
  color: palette.neutral400,
  fontSize: 11,
  fontFamily: 'PlusJakartaSans-Regular',
} as const;

// Add to LineChart component:
pointerConfig={{
  pointerStripHeight: CHART_HEIGHT,
  pointerStripColor: palette.neutral500,
  pointerStripWidth: 1,
  pointerColor: palette.accent500, // or palette.signature500 for elevation
  radius: 5,
  pointerLabelWidth: 120,
  pointerLabelHeight: 50,
  activatePointersOnLongPress: true, // REQUIRED — preserves BottomSheet scroll
  autoAdjustPointerLabelPosition: true,
  shiftPointerLabelX: -40,
  shiftPointerLabelY: -55,
  pointerLabelComponent: (items: ChartDataItem[]) => {
    const item = items[0];
    return (
      <View style={TOOLTIP_STYLE}>
        <Text style={TOOLTIP_VALUE_STYLE}>
          {item.value} {unit}
        </Text>
        <Text style={TOOLTIP_DIST_STYLE}>
          {item.dist.toFixed(1)} {distUnit}
        </Text>
      </View>
    );
  },
}}
```

#### Gesture Conflict Resolution

**Problem:** `pointerConfig` adds touch handlers that compete with `BottomSheetScrollView` for gesture ownership. The user tries to scrub the chart but the sheet scrolls instead.

**Solution:** Disable BottomSheet content panning when a chart is active:

```tsx
// ride-detail.tsx — BottomSheet component
<BottomSheet
  enableContentPanningGesture={activeChart === null}
  // ... other props
>
```

This tells the sheet "hands off scroll gestures while a chart is visible." The user can still use the handle indicator to drag the sheet.

### Phase 3: Animation Choreography

**Problem:** `handleStatTap` calls `setActiveChart` and `sheetRef.current?.snapToIndex(2)` simultaneously. The chart mounts and animates while the sheet is still sliding upward, creating a "two things moving at different speeds" effect.

**Solution:** Defer chart rendering until the sheet has finished snapping:

```tsx
const pendingChartRef = useRef<ChartType | null>(null);

const handleStatTap = useCallback((chart: ChartType) => {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  setActiveChart((prev) => {
    if (prev === chart) return null; // toggle off
    pendingChartRef.current = chart;
    sheetRef.current?.snapToIndex(2);
    return null; // clear current chart during transition
  });
}, []);

// In BottomSheet onChange:
onChange={(index) => {
  setIsMapFullScreen(index === -1);
  if (index === 2 && pendingChartRef.current) {
    setActiveChart(pendingChartRef.current);
    pendingChartRef.current = null;
  }
  if (index === -1) setActiveChart(null); // clear chart on sheet dismiss
}}
```

### Phase 4: Additional Stat Tiles

**File:** `apps/mobile/src/app/(modals)/ride-detail.tsx`

Add elevation loss stat tile and update `STAT_CHART_MAP`:

```tsx
// Update STAT_CHART_MAP to include new label
const STAT_CHART_MAP: Record<string, ChartType | null> = {
  'Avg Speed': 'speed',
  'Max Speed': 'speed',
  Elevation: 'elevation',
  'Elev. Loss': 'elevation', // NEW — tapping opens elevation chart
  Distance: null,
  'Moving Time': null,
};

// Updated stats array
const elevationLoss = ride.elevationLoss ?? 0;

const stats = [
  { icon: Route, label: 'Distance', value: formatDistance(distanceM, system) },
  { icon: Clock, label: 'Moving Time', value: formatDuration(durationS) },
  { icon: Gauge, label: 'Avg Speed', value: formatSpeed(avgSpeedMps, system) },
  { icon: Gauge, label: 'Max Speed', value: formatSpeed(maxSpeedMps, system) },
  ...(elevationGain > 0
    ? [{ icon: Mountain, label: 'Elevation', value: formatElevation(elevationGain, system) }]
    : []),
  ...(elevationLoss > 0
    ? [{ icon: Mountain, label: 'Elev. Loss', value: formatElevation(elevationLoss, system) }]
    : []),
];
```

### Phase 5: Downsampling Peak Preservation

**Files:** `ride-speed-chart.tsx`, `ride-elevation-chart.tsx`

The current every-Nth-point downsampling can miss the actual max speed or min/max altitude, creating a visual mismatch with stat tiles.

**Speed chart — preserve max speed index:**

```tsx
const maxSpeedIdx = valid.reduce((mi, wp, i) =>
  (wp.speedMps ?? 0) > (valid[mi].speedMps ?? 0) ? i : mi, 0);

const step = Math.max(1, Math.floor(valid.length / 60));
const sampled = valid.filter((_, i) =>
  i % step === 0 || i === valid.length - 1 || i === maxSpeedIdx
);
// Array.filter preserves index order — no sort needed
```

**Elevation chart — preserve max AND min altitude indices:**

```tsx
const maxAltIdx = valid.reduce((mi, wp, i) =>
  (wp.altitude ?? 0) > (valid[mi].altitude ?? 0) ? i : mi, 0);
const minAltIdx = valid.reduce((mi, wp, i) =>
  (wp.altitude ?? 0) < (valid[mi].altitude ?? 0) ? i : mi, 0);

const sampled = valid.filter((_, i) =>
  i % step === 0 || i === valid.length - 1 || i === maxAltIdx || i === minAltIdx
);
```

## Acceptance Criteria

- [ ] Speed chart X-axis shows distance (km or mi) instead of elapsed time
- [ ] Elevation chart X-axis continues to show distance (km or mi) — no regression
- [ ] Both charts support press-and-hold to show a crosshair with tooltip displaying the Y-value and distance
- [ ] Tooltip styles defined as constants outside the component (no re-creation during drag)
- [ ] `pointerLabelComponent` callback parameter is explicitly typed (no implicit `any`)
- [ ] Chart data items preserve `dist` property (not stripped before passing to LineChart)
- [ ] Elevation loss stat tile appears when `elevationLoss > 0` and maps to elevation chart
- [ ] `STAT_CHART_MAP` updated with `'Elev. Loss': 'elevation'`
- [ ] Downsampling preserves max speed point and min/max altitude points
- [ ] BottomSheet content panning disabled when chart is active (gesture conflict fix)
- [ ] Chart mount deferred until sheet snap completes (animation choreography)
- [ ] `activeChart` cleared when sheet is dismissed to index -1
- [ ] All colors from `palette` tokens — no hardcoded hex values
- [ ] All distance/speed/elevation values use formatters from `ride-formatters.ts`
- [ ] Charts respect metric/imperial measurement system preference
- [ ] Charts still show "Insufficient data" message when waypoints < 10
- [ ] `activatePointersOnLongPress: true` set on both charts (preserves scroll)

## Technical Considerations

- **`pointerConfig` and `hideDataPoints` are independent** — `hideDataPoints` controls static dots on the line, `pointerConfig` renders its own dynamic pointer. No conflict. Keep `hideDataPoints` as-is.
- **`pointerLabelComponent` re-renders every frame during drag** — keep the component extremely lightweight. Pre-compute formatted values, define styles as constants outside the component, avoid shadows/blur.
- **Haversine extraction**: Move `haversineDistance` from `ride-elevation-chart.tsx` to `apps/mobile/src/utils/geo-utils.ts`. Both charts import from there.
- **Performance**: 60 haversine calls in `useMemo` completes in <1ms. No optimization needed.
- **Font override**: Per learnings, always override chart text styles with app font (`PlusJakartaSans-*`) to avoid Comic Sans default.
- **Chart animation on low-end Android**: `curved` + `areaChart` + `isAnimated` runs on JS thread. If jank is observed, remove `isAnimated` and rely on reanimated `FadeInUp` (which runs on UI thread).
- **No duplicate waypoints from peak preservation**: `Array.filter` preserves order and doesn't create duplicates even if `maxSpeedIdx` coincides with an `i % step === 0` boundary.

## Files to Modify

| File | Change |
|---|---|
| `apps/mobile/src/components/ride/ride-speed-chart.tsx` | X-axis → distance, add `pointerConfig`, peak preservation, import shared `haversineDistance` |
| `apps/mobile/src/components/ride/ride-elevation-chart.tsx` | Add `pointerConfig`, peak preservation, preserve `dist` on data items, import shared `haversineDistance` |
| `apps/mobile/src/app/(modals)/ride-detail.tsx` | Add elevation loss stat tile, update `STAT_CHART_MAP`, defer chart mount, disable content panning, clear chart on dismiss |
| `apps/mobile/src/utils/geo-utils.ts` (NEW) | Extract shared `haversineDistance` function |

## Out of Scope

- Chart-to-map sync (highlighting map point when scrubbing chart) — future iteration
- Heading/lean angle charts — heading not in GraphQL model, lean_angle never written per-waypoint
- Accuracy indicator on charts — server already filters low-accuracy waypoints
- Moving Time calculation fix (paused time subtraction) — separate issue
- Guard against incomplete rides in detail — separate issue
- LTTB downsampling algorithm — stride + peak preservation is sufficient for v1

## Sources

- Existing elevation chart: `apps/mobile/src/components/ride/ride-elevation-chart.tsx`
- Existing speed chart: `apps/mobile/src/components/ride/ride-speed-chart.tsx`
- Ride detail screen: `apps/mobile/src/app/(modals)/ride-detail.tsx`
- Charting library: `react-native-gifted-charts` v1.4.76+ (already installed)
- Learnings: `docs/solutions/integration-issues/expense-dashboard-server-aggregation-charting.md`
- Learnings: `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`
- Library types: `node_modules/gifted-charts-core/dist/utils/types.d.ts` (Pointer interface)
- Library source: `node_modules/gifted-charts-core/dist/LineChart/types.d.ts` (lineDataItem)
