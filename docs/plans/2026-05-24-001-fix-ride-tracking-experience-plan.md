---
title: Fix Ride Tracking Experience (P0-P3)
type: fix
status: completed
date: 2026-05-24
deepened: true
---

# Fix Ride Tracking Experience (P0-P3)

## Enhancement Summary

**Deepened on:** 2026-05-24
**Sources:** PostHog analytics, Supabase DB, ride-hud-reanimated-charts-mileage-patterns.md, measurement-system-and-ride-feature-design.md

### Critical Implementation Constraints (from learnings)
1. **Timer/interval patterns**: Auto-save timer MUST use `useRef` for fast-changing values — never put `distance` or `elapsed` in useEffect deps (causes interval reset, see learning #4)
2. **TanStack Query keys**: If adding new ride queries for milestones/personal records, use DISTINCT query keys from existing `queryKeys.rides.all` (cache collision learning)
3. **Formatters**: All distance/speed/elevation display MUST use centralized `ride-formatters.ts` + `useMeasurementSystem()` hook — no local formatting
4. **Reanimated patterns**: GPS pulse animation must use `useDerivedValue` for pure computation only; side effects go in `useAnimatedReaction`
5. **useCallback stability**: `handleEndRide` in ride-hud.tsx already uses ref pattern for elapsed — new minimum-ride-guard must follow same pattern

## Overview

Ride tracking is MotoVault's highest-engagement feature (peak 7 unique users/week, more than expenses or maintenance), but suffers from critical first-ride dropout: 13/17 users created only zero-distance rides and never returned. The completion rate is 64% overall with worst-week drops to 32%. This plan addresses the full ride lifecycle from first-ride onboarding through post-ride engagement.

## Problem Statement

**Data-driven findings (PostHog + Supabase, Slovakia excluded):**

| Metric | Value |
|---|---|
| Total rides in DB | 109 |
| Unique riders | 17 |
| Real rides (>100m) | 77 (73% of completed) |
| Zero-distance rides | 28 (27% of completed) |
| Completion rate (PostHog) | 64% (101 started → 65 completed) |
| Power user concentration | 1 user = 77% of all real rides |
| Ride sharing | 2 total (effectively zero) |
| Geographic distribution | 75% US, rest scattered |

**Root causes identified:**
1. No GPS readiness feedback — users start rides before location lock
2. No minimum ride guard — users can end rides instantly (0m, 8s)
3. No first-ride guidance — HUD is complex with no onboarding
4. Manual save required — "Save Ride" vs "Discard" adds friction after every ride
5. No explicit discard tracking — analytics blind to the save/discard decision

## Proposed Solution

### Phase 1: P0 — First-Ride Experience (Critical)

#### 1.1 GPS Readiness Gate on Start-Ride Screen

**File:** `apps/mobile/src/app/(modals)/start-ride.tsx`

Before enabling the "Start Ride" button, show GPS acquisition status:

```tsx
// start-ride.tsx — GPS readiness indicator
const { location, accuracy } = useLocationPermission();
const isGpsReady = accuracy !== null && accuracy < 20; // 20m threshold

<Animated.View entering={FadeIn}>
  <View style={styles.gpsStatus}>
    {isGpsReady ? (
      <GpsReadyIndicator accuracy={accuracy} />
    ) : (
      <GpsAcquiringIndicator />
    )}
  </View>
</Animated.View>

// Disable start button until GPS ready (with override after 10s)
<Button
  disabled={!isGpsReady && !overrideTimeout}
  onPress={handleStartRide}
  label={isGpsReady ? "Start Ride" : "Acquiring GPS..."}
/>
```

**Behavior:**
- GPS indicator pulses while acquiring (reanimated)
- Button disabled for first 10 seconds if no GPS fix
- After 10s, button enables with warning: "GPS accuracy is low — ride data may be incomplete"
- Track event: `ride_start_gps_state: { accuracy, wait_time_s, was_override }`

#### 1.2 Minimum Ride Guard on End-Ride

**File:** `apps/mobile/src/app/(modals)/ride-hud.tsx`

When user taps "End Ride" with < 30 seconds elapsed OR < 50m distance:

```tsx
// ride-hud.tsx — minimum ride guard
const handleEndRide = () => {
  const elapsed = Date.now() - startedAt;
  const distance = rideStore.distance;
  
  if (elapsed < 30_000 || distance < 50) {
    // Show guidance sheet instead of immediately ending
    setShowTooShortSheet(true);
    return;
  }
  proceedToEndRide();
};
```

**"Too Short" Bottom Sheet content:**
- "Your ride was very short (Xs, Ym). Are you sure you want to end it?"
- Options: "Keep Riding" (dismiss sheet) | "End Anyway" (proceed)
- First-time: Add tip: "Tip: Make sure your phone has a clear view of the sky for best GPS tracking"
- Track: `ride_too_short_shown: { elapsed_s, distance_m, action: 'keep' | 'end' }`

#### 1.3 First-Ride HUD Onboarding Overlay

**File:** `apps/mobile/src/app/(modals)/ride-hud.tsx` (new component)

On the user's very first ride (check via MMKV flag `hasCompletedFirstRide`):

```tsx
// First-ride overlay: semi-transparent coach marks
const FirstRideOverlay = () => (
  <Animated.View entering={FadeIn.delay(1500)} style={styles.overlay}>
    <CoachMark target="speedDisplay" text="Your current speed" />
    <CoachMark target="distanceDisplay" text="Total distance traveled" />
    <CoachMark target="endButton" text="Tap here when you're done riding" />
    <Text style={styles.dismissHint}>Tap anywhere to dismiss</Text>
  </Animated.View>
);
```

**Behavior:**
- Appears 1.5s after HUD loads (after GPS starts)
- Tapping anywhere dismisses permanently
- Never shown again (MMKV: `firstRideOverlayDismissed`)
- Track: `first_ride_overlay_shown`, `first_ride_overlay_dismissed: { time_on_screen_ms }`

#### 1.4 Zero-Distance Summary Guidance

**File:** `apps/mobile/src/app/(modals)/ride-summary.tsx`

When ride has 0m distance, replace the normal summary with helpful guidance:

```tsx
// ride-summary.tsx — zero distance state
if (distance === 0) {
  return (
    <ZeroDistanceGuidance
      onTryAgain={() => router.replace('/(modals)/start-ride')}
      onDiscard={handleDiscard}
    />
  );
}
```

**ZeroDistanceGuidance shows:**
- "No distance recorded" with illustration
- Troubleshooting tips: GPS needs clear sky view, ensure location permissions are "Always" or "While Using"
- "Try Again" button (primary) → navigates back to start-ride
- "Discard" button (secondary) → deletes ride
- Track: `zero_distance_guidance_shown`, `zero_distance_guidance_action: 'try_again' | 'discard'`

---

### Phase 2: P1 — Completion Flow & Analytics

#### 2.1 Add RIDE_DISCARDED Analytics Event

**File:** `apps/mobile/src/app/(modals)/ride-summary.tsx`

Currently, discarding a ride fires no analytics event. Add explicit tracking:

```tsx
// ride-summary.tsx — discard handler (lines ~272-285)
const handleDiscard = async () => {
  // NEW: Track discard with context
  track(AnalyticsEvent.RIDE_DISCARDED, {
    ride_id: rideId,
    distance_m: distance,
    duration_s: durationS,
    reason: discardReason, // from optional feedback prompt
    had_waypoints: waypointCount > 0,
  });
  
  await deleteRide({ variables: { id: rideId } });
  clearLocalRideData();
  router.replace('/(tabs)/(profile)/rides');
};
```

**Add to analytics.ts:**
```tsx
RIDE_DISCARDED = 'ride_discarded',
```

#### 2.2 Auto-Save with Undo (Replace Manual Save)

**File:** `apps/mobile/src/app/(modals)/ride-summary.tsx`

Instead of requiring users to tap "Save Ride", auto-save after 3 seconds with an undo option:

```tsx
// ride-summary.tsx — auto-save pattern
const AUTO_SAVE_DELAY = 3000;

useEffect(() => {
  if (distance > 0) {
    const timer = setTimeout(() => {
      handleSaveRide(); // Same logic as current "Save" button
      setAutoSaved(true);
    }, AUTO_SAVE_DELAY);
    
    return () => clearTimeout(timer);
  }
}, []);

// Show countdown + discard option
{!autoSaved && distance > 0 && (
  <AutoSaveBar
    countdown={AUTO_SAVE_DELAY}
    onDiscard={handleDiscard}
    label="Auto-saving in..."
  />
)}

{autoSaved && (
  <UndoBar
    duration={5000}
    onUndo={handleUndoSave}
    label="Ride saved"
  />
)}
```

**Behavior:**
- Ride auto-saves after 3s on summary screen (if distance > 0)
- User can tap "Discard" during countdown to prevent save
- After save, 5s undo window appears
- Zero-distance rides show guidance instead (Phase 1.4)
- Track: `ride_auto_saved: { undo_tapped: boolean }`

#### 2.3 Reduce Accidental Starts

**File:** `apps/mobile/src/app/(modals)/start-ride.tsx`

Add a "slide to start" gesture instead of a simple tap:

```tsx
// start-ride.tsx — slide to start
<SlideToAction
  onComplete={handleStartRide}
  label="Slide to Start Ride"
  icon={<PlayIcon />}
  disabled={!isGpsReady && !overrideTimeout}
/>
```

This prevents accidental taps from starting rides, reducing the zero-distance problem at the source.

---

### Phase 3: P2 — Ride History Enhancement

#### 3.1 Personal Records Banner

**File:** `apps/mobile/src/app/(tabs)/(profile)/rides.tsx`

Show personal records at the top of ride history:

```tsx
// rides.tsx — personal records section
const PersonalRecords = ({ rides }: { rides: RideEdge[] }) => {
  const records = useMemo(() => ({
    longestDistance: Math.max(...rides.map(r => r.distanceM || 0)),
    fastestSpeed: Math.max(...rides.map(r => r.maxSpeedMps || 0)) * 3.6,
    longestDuration: Math.max(...rides.map(r => r.durationS || 0)),
    highestElevation: Math.max(...rides.map(r => r.elevationGain || 0)),
  }), [rides]);

  return (
    <View style={styles.records}>
      <RecordTile icon="route" label="Longest" value={formatDistance(records.longestDistance)} />
      <RecordTile icon="speed" label="Fastest" value={formatSpeed(records.fastestSpeed)} />
      <RecordTile icon="timer" label="Longest" value={formatDuration(records.longestDuration)} />
      <RecordTile icon="mountain" label="Highest" value={formatElevation(records.highestElevation)} />
    </View>
  );
};
```

#### 3.2 Period Comparison

**File:** `apps/mobile/src/app/(tabs)/(profile)/rides.tsx`

Add "vs last period" comparison to the existing period stats:

```tsx
// Existing period stats + delta comparison
<StatRow
  label="This week"
  value={thisWeekDistance}
  delta={thisWeekDistance - lastWeekDistance}  // shows +/- vs last week
  deltaLabel="vs last week"
/>
```

#### 3.3 Ride Milestones

**File:** New component `apps/mobile/src/components/rides/RideMilestone.tsx`

Show milestone celebrations when users hit targets:

| Milestone | Trigger |
|---|---|
| First Ride | Complete first real ride (>1km) |
| Century | 100km total distance |
| Road Warrior | 1,000km total |
| Speed Demon | First ride > 100 km/h max |
| Mountain Goat | First ride > 500m elevation |
| Regular | 5 rides in one week |

```tsx
// Check milestones on ride completion
const checkMilestones = (rides: Ride[], latestRide: Ride) => {
  const totalDistance = rides.reduce((sum, r) => sum + (r.distanceM || 0), 0);
  const newMilestones: Milestone[] = [];
  
  if (rides.length === 1 && latestRide.distanceM > 1000) {
    newMilestones.push('first_ride');
  }
  if (totalDistance >= 100_000 && totalDistance - latestRide.distanceM < 100_000) {
    newMilestones.push('century');
  }
  // ... etc
  
  return newMilestones;
};
```

Show milestone toast on ride-summary screen after save.

---

### Phase 4: P3 — Defer (No Work)

- Ride sharing: 2 total shares — no investment
- Upgrade CTA optimization: 4 impressions — premature
- Document decision: revisit when ride tracking reaches 20+ active riders

---

## Technical Considerations

### Architecture Impacts
- GPS readiness gate reuses existing `expo-location` subscription — no new permissions
- Auto-save changes the ride lifecycle: summary screen becomes read-only after 3s
- Milestones are computed client-side from cached rides — no new API endpoints
- MMKV flags for first-ride state: `hasCompletedFirstRide`, `firstRideOverlayDismissed`

### Performance
- GPS indicator uses `watchPositionAsync` already active — no extra battery drain
- Auto-save timer is a simple `setTimeout` — negligible
- Personal records computed in `useMemo` from already-fetched ride list
- Milestone check runs once per ride completion

### Risks
- Auto-save could surprise users who expect manual control → mitigated by undo window
- Slide-to-start might frustrate power users → keep gesture short (120px) and responsive
- GPS gate could block users in areas with poor signal → 10s override prevents permanent blocking

## System-Wide Impact

### Interaction Graph
- `start-ride.tsx` → GPS readiness → `ride-hud.tsx` → minimum guard → `ride-summary.tsx` → auto-save → rides cache invalidation
- Auto-save triggers same `updateRide` mutation + `ride.completed` EventEmitter2 event → AI summary generation
- Milestone check reads from TanStack Query cache (already populated)

### Error Propagation
- GPS timeout: 10s override prevents blocking; user proceeds with warning
- Auto-save failure: Show error toast, fall back to manual save button
- Milestone calculation: Pure client-side, no server dependency

### State Lifecycle Risks
- Auto-save timer cleanup on unmount (useEffect return) prevents orphaned saves
- MMKV flags are write-once, read-many — no race conditions
- Undo after auto-save: calls `deleteRide` (same as discard) — already idempotent

## Acceptance Criteria

### P0: First-Ride Experience
- [x] GPS readiness indicator shown on start-ride screen with accuracy display
- [x] Start button disabled until GPS fix (< 20m accuracy) OR 10s timeout
- [x] Minimum ride guard triggers for rides < 30s OR < 50m
- [x] First-ride HUD overlay shows coach marks on first ever ride
- [x] Zero-distance rides show troubleshooting guidance instead of normal summary
- [x] All new states tracked in PostHog with relevant properties

### P1: Completion Flow
- [x] `RIDE_DISCARDED` event fires with ride context when user discards
- [x] Rides auto-save after 3s on summary screen (distance > 0)
- [x] 5s undo window after auto-save
- [x] Slide-to-start replaces tap-to-start button
- [x] Zero-distance rides bypass auto-save (show guidance instead)

### P2: History Enhancement
- [x] Personal records banner shows at top of rides history
- [x] Period comparison shows delta vs previous period
- [x] Ride milestones fire and display toast on ride completion
- [x] At least 6 milestone types implemented

### P3: Defer
- [x] No changes to sharing or upgrade CTA
- [x] Decision documented in this plan

## Success Metrics

| Metric | Current | Target (30 days) |
|---|---|---|
| Zero-distance ride rate | 27% | < 10% |
| Ride completion rate | 64% | > 80% |
| First-ride-to-second-ride retention | ~3/17 (18%) | > 40% |
| Avg rides per active user/week | 1.2 (excl. power user) | 2.0+ |
| Ride history views/rider/week | 3.8 | 5.0+ |

## Implementation Phases

### Phase 1 (P0): ~2-3 hours
- GPS readiness gate
- Minimum ride guard
- First-ride overlay
- Zero-distance guidance

### Phase 2 (P1): ~2 hours
- RIDE_DISCARDED event
- Auto-save with undo
- Slide-to-start

### Phase 3 (P2): ~2-3 hours
- Personal records
- Period comparison
- Milestones

## Files to Modify

| File | Changes |
|---|---|
| `apps/mobile/src/app/(modals)/start-ride.tsx` | GPS readiness gate, slide-to-start |
| `apps/mobile/src/app/(modals)/ride-hud.tsx` | Minimum ride guard, first-ride overlay |
| `apps/mobile/src/app/(modals)/ride-summary.tsx` | Auto-save, zero-distance guidance, RIDE_DISCARDED |
| `apps/mobile/src/app/(tabs)/(profile)/rides.tsx` | Personal records, period comparison |
| `apps/mobile/src/lib/analytics.ts` | New event constants |
| `apps/mobile/src/components/rides/RideMilestone.tsx` | NEW: milestone component |
| `apps/mobile/src/components/rides/FirstRideOverlay.tsx` | NEW: coach marks overlay |
| `apps/mobile/src/components/rides/ZeroDistanceGuidance.tsx` | NEW: troubleshooting view |
| `apps/mobile/src/components/rides/SlideToAction.tsx` | NEW: slide gesture button |
| `apps/mobile/src/components/rides/GpsReadinessIndicator.tsx` | NEW: GPS status display |
| `apps/mobile/src/components/rides/AutoSaveBar.tsx` | NEW: auto-save countdown |

## Implementation Constraints (from Institutional Learnings)

### From `ride-hud-reanimated-charts-mileage-patterns.md`:
- **Auto-save timer**: Use `useRef` for distance/elapsed values read inside setTimeout. Do NOT put distance in useEffect deps:
  ```tsx
  const distanceRef = useRef(distance);
  distanceRef.current = distance;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (distanceRef.current > 0) handleSaveRide();
    }, AUTO_SAVE_DELAY);
    return () => clearTimeout(timer);
  }, []); // stable — no fast-changing deps
  ```
- **GPS pulse animation**: Use `useAnimatedReaction` for side effects (updating accuracy state), `useDerivedValue` only for the pulse interpolation
- **handleEndRide stability**: Minimum ride guard reads `elapsedRef.current` and `distanceRef.current` — never add these to useCallback deps

### From `measurement-system-and-ride-feature-design.md`:
- **Personal Records display**: MUST use `formatDistance()`, `formatSpeed()`, `formatElevation()` from `ride-formatters.ts` with `useMeasurementSystem()` — never hardcode `km` or `mph`
- **Query keys for milestones**: If fetching ride stats for records/milestones, use `queryKeys.rides.list('records')` — NOT `queryKeys.rides.all` (cache collision risk)
- **Colors**: All milestone/record UI must use `palette` tokens from `@motovault/design-system` — signature copper (#D4622E) for achievements

### From existing ride-hud.tsx patterns:
- **Minimum ride guard placement**: Must be in the same `handleEndRide` callback that already uses `elapsedRef` — check distance via `rideStore.getState().distance` (Zustand non-reactive get)
- **Bottom sheets**: Use existing `@gorhom/bottom-sheet` pattern already in ride-hud for the "too short" confirmation
- **MMKV flags**: Follow existing pattern from crash recovery — `MMKV.set('firstRideOverlayDismissed', true)` in the rides MMKV instance

## Sources & References

- PostHog ride events: ride_started, ride_completed, ride_ended, ride_paused, ride_abandoned, ride_deleted
- Supabase rides table: `supabase/migrations/00047_create_rides_table.sql`
- Ride HUD patterns: `docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md`
- Measurement system: `docs/solutions/architecture/measurement-system-and-ride-feature-design.md`
- Offline resilience: `docs/brainstorms/2026-04-26-offline-resilience-brainstorm.md`
- Ride logging plan: Core architecture in `docs/plans/2026-03-22-*-ride-logging-plan.md`
