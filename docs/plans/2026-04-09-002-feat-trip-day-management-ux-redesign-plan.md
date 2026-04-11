---
title: "feat: Trip Planner Day Management UX Redesign"
type: feat
status: active
date: 2026-04-09
deepened: 2026-04-09
---

# Trip Planner Day Management UX Redesign

## Enhancement Summary

**Deepened on:** 2026-04-09
**Agents used:** Architecture Strategist, TypeScript Reviewer, Performance Oracle, Frontend Races Reviewer, Code Simplicity Reviewer, Best Practices Researcher, Learnings Researcher

### Key Improvements from Deepening
1. **Phased approach**: MVP is just Add Day button + bug fix (~50 LOC). Pill strip/collapse deferred to Phase 2.
2. **Race condition fix**: Existing route debounce has a critical stale-data bug — needs AbortController.
3. **Performance**: Extract TripMap component with React.memo to eliminate 80%+ unnecessary re-renders.
4. **Type safety**: Use `Record<number, boolean>` instead of `Set<number>` for collapsed state.
5. **Restrict Remove Day**: Only allow removing the last day to avoid complex index shifting.

---

## Overview

The trip planner's day management is non-intuitive: adding days requires changing the end date picker, with no visible affordance. This redesign adds an explicit "+ Add Day" button as the primary fix, with optional Phase 2 enhancements.

## Problem Statement

- Days are derived implicitly from `Math.round((endDate - startDate) / msPerDay) + 1` (create-trip.tsx:484-487)
- No "+ Add Day" button exists anywhere in the UI
- The end date picker serves as a hidden day-count control
- New waypoints are hardcoded to `dayIndex: 0` (lines 314, 332) regardless of trip length
- Pre-existing bug: `updateMutation` (line 450-462) does NOT include waypoints — edit mode silently loses all waypoint changes

---

## Phase 1: MVP (Ship First)

**Scope: ~50-80 LOC changed, 0 new components**

### 1.1 "+ Add Day" Button

Add a prominent button at the bottom of the day list that increments `endDate` by one day.

**File:** `apps/mobile/src/app/(modals)/create-trip.tsx`

- Render after the last day section (after line 827)
- `onPress`: increment endDate by 1 day
- Cap at 14 days maximum — disable button with subtle label
- Haptic feedback on press
- Import `Plus` from lucide-react-native

```tsx
const handleAddDay = useCallback(() => {
  setEndDate(prev => {
    const d = new Date(prev);
    d.setDate(d.getDate() + 1);
    return d;
  });
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}, []);

// In JSX, after day list loop (line 827):
{numDays < 14 && (
  <Pressable
    onPress={handleAddDay}
    accessibilityLabel="Add another day to trip"
    accessibilityRole="button"
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 12,
      paddingVertical: 14,
      borderRadius: 12,
      borderCurve: 'continuous',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: palette.accent500,
    }}
  >
    <Plus size={18} color={palette.accent500} />
    <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent500 }}>
      Add Day
    </Text>
  </Pressable>
)}
```

### 1.2 Fix updateMutation to Include Waypoints (Bug Fix)

**Bug:** `updateMutation` (line 450-462) sends title, description, dates, difficulty, maxRiders but NOT waypoints. Day management changes in edit mode are silently lost.

**Fix — Mobile side:**
- Use `buildTripInput()` (line 377-396) in the update mutation variables, same as save/publish

**Fix — API side (REQUIRED):**
- `apps/api/src/modules/trips/dto/update-trip.input.ts` — add `waypoints` field to `UpdateTripInput`
- `apps/api/src/modules/trips/trips.service.ts` — handle waypoint upsert in update (delete existing + insert new, within transaction)
- `apps/mobile/src/graphql/mutations/update-trip.graphql` — include waypoints in variables
- Run `pnpm generate` after changes

### 1.3 Fix Route Debounce Race Condition (Pre-existing Critical Bug)

**Bug found by Races Reviewer:** The route recalculation effect (line 139-162) uses a setTimeout debounce but has no cancellation for in-flight API calls. On slow networks, a stale route response can overwrite a newer one.

**Fix:** Add AbortController to the route calculation:

```tsx
useEffect(() => {
  if (waypoints.length < 2) {
    setRouteLegs([]);
    setRouteGeometry(null);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(async () => {
    const sorted = [...waypoints].sort((a, b) => a.sortOrder - b.sortOrder);
    const coords = sorted.map(wp => ({ lat: wp.lat, lng: wp.lng }));
    const result = await getRouteSegments(coords, controller.signal);
    if (!controller.signal.aborted && result) {
      setRouteLegs(result.legs);
      setRouteGeometry(result.geometry);
    }
  }, 800);

  return () => {
    clearTimeout(timer);
    controller.abort();
  };
}, [waypoints]);
```

**Also:** Update `getRouteSegments` in `mapbox-directions.ts` to accept and pass `signal` to fetch.

### 1.4 Fix Waypoint Day Assignment

New waypoints should go to the last day with existing waypoints (or day 0 if empty), not hardcoded to 0.

- Update `handleGeocodingSelect` (line 314): `dayIndex: waypoints.length > 0 ? Math.max(...waypoints.map(w => w.dayIndex)) : 0`
- Update `handleLongPress` (line 332): same

---

## Phase 2: UX Polish (Defer Until Phase 1 Ships)

Only implement after Phase 1 is validated by real usage.

### 2.1 Horizontal Day Pill Strip

- New component: `apps/mobile/src/components/trip/day-pill-strip.tsx`
- Horizontal `ScrollView` with pills for each day
- Active pill determines which day new waypoints are assigned to
- Tap pill → scroll BottomSheetScrollView to that day section

**Research Insight (Best Practices):** Use `onLayout` callbacks on each day `<View>` to record Y offsets in a `Partial<Record<number, number>>` ref (not `Record<number, number>` — forces null checks). Auto-expand bottom sheet to 45% snap before scrolling.

### 2.2 Collapsible Day Headers

- Use `Record<number, boolean>` for collapsed state (NOT `Set<number>` — avoids immutability bugs)
- Toggle: `setCollapsedDays(prev => ({ ...prev, [dayIndex]: !prev[dayIndex] }))`
- Use reanimated v4 `LayoutAnimation` (entering/exiting) on the waypoint container
- Chevron indicator: down = expanded, right = collapsed

### 2.3 Remove Day (Last Day Only)

**Simplification from Architecture Review:** Only allow removing the last day. This avoids complex middle-day index shifting.

- "Remove Day" option in day header context menu (last day only)
- Confirmation if day has waypoints: "Day N has X stops. Delete them?"
- On confirm: filter out waypoints on last day, retract endDate by 1 day
- Minimum 1 day enforced

### 2.4 Component Extraction

Extract from create-trip.tsx to manage file size:
- `DayPillStrip` → `apps/mobile/src/components/trip/day-pill-strip.tsx`
- `DaySection` → `apps/mobile/src/components/trip/day-section.tsx`
- `TripMap` → `apps/mobile/src/components/trip/trip-map.tsx` (wrap in `React.memo` — eliminates 80%+ re-renders)
- `TripMetadataForm` → form inputs extraction
- Consider `useTripForm` hook for form state

---

## Research Insights

### Performance (from Performance Oracle)

- **P0:** Extract map + bottom sheet into separate `React.memo` components. The 1363-line component re-renders entirely on any state change. A `TripMap` that only re-renders on `waypoints`/`routeGeoJSON`/`mapStyle` changes eliminates most wasted work.
- **P0:** Pre-compute `globalIdx` in `waypointsByDay` useMemo. The current `sortedWaypoints.indexOf(wp)` calls in the render loop are O(n^2).
- **P1:** Route recalculation debounce should depend on a coordinate fingerprint, not raw `waypoints` reference — avoids unnecessary Mapbox API calls when only name/type/day changes.
- **P2:** Wrap `StopListItem` in `React.memo` with `waypoint.id` key comparison.

### Race Conditions (from Races Reviewer)

- **CRITICAL:** Route debounce can write stale geometry on slow networks. AbortController required (see 1.3).
- **MODERATE:** `sortOrder` computed from stale closure on rapid waypoint adds. Compute inside `setWaypoints` functional updater.
- **MODERATE:** Save/publish mutations can double-fire on rapid taps. Guard with a synchronous ref: `const submittingRef = useRef(false)`.
- **PLANNED:** If Phase 2 adds `activeDayIndex`, consider `useReducer` for temporal state (`startDate`, `endDate`, `activeDayIndex`) to avoid cross-state races.

### TypeScript Safety (from TS Reviewer)

- **HIGH:** `type: string` on `LocalWaypoint` should be a union type from `@motovault/types` (`WaypointType`)
- **HIGH:** `dayLayoutsRef` must use `Partial<Record<number, number>>` to force null checks
- **MEDIUM:** Passing `Date` objects as props breaks `React.memo` shallow comparison. Store as ISO string or epoch in state; convert to `Date` at display layer.

---

## Acceptance Criteria

### Phase 1
- [x] "+ Add Day" button visible below the day list, adds a new day on press
- [x] Maximum 14 days enforced (button disables at 14)
- [x] Edit mode: updateMutation includes waypoints (full-stack fix)
- [x] Route debounce uses AbortController (no stale geometry)
- [x] New waypoints assigned to last active day, not always Day 1
- [x] Works on both iOS and Android

### Phase 2 (Future)
- [ ] Horizontal pill strip shows all days, tapping scrolls to day section
- [ ] Day headers tappable to collapse/expand
- [ ] "Remove Day" option for last day (with confirmation)
- [ ] TripMap extracted with React.memo
- [ ] VoiceOver/TalkBack accessible

## Files to Modify (Phase 1)

- `apps/mobile/src/app/(modals)/create-trip.tsx` — Add Day button, fix waypoint dayIndex, fix route debounce
- `apps/mobile/src/utils/mapbox-directions.ts` — Accept AbortSignal in getRouteSegments
- `apps/api/src/modules/trips/dto/update-trip.input.ts` — Add waypoints field
- `apps/api/src/modules/trips/trips.service.ts` — Handle waypoint upsert in update
- `apps/mobile/src/graphql/mutations/update-trip.graphql` — Add waypoints to variables
- Run `pnpm generate` after API changes

## Implementation Order (Phase 1)

1. **Fix route debounce race condition** — AbortController + signal passing
2. **Fix updateMutation** — full-stack (API DTO → service → GraphQL → generate)
3. **Add "+ Add Day" button** — simple endDate increment + haptics
4. **Fix waypoint dayIndex** — default to last active day

## Verification (Phase 1)

1. Create a new trip → 2 days by default (start/end dates)
2. Tap "+ Add Day" → new day appears, endDate advances by 1
3. Verify max 14 days cap → button disables
4. Add waypoint via search → goes to last day, not Day 1
5. Edit an existing trip → save preserves all waypoint changes
6. Rapid waypoint adds on slow network → no stale route geometry
7. Change end date via picker → days recompute correctly
8. Test on Android
