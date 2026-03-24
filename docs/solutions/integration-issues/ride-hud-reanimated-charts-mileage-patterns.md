---
title: "Ride HUD Redesign: Reanimated Patterns, Chart Tooltips, and Mileage Safety"
category: integration-issues
date: 2026-03-23
tags: [react-native-reanimated, react-native-gifted-charts, supabase, useEffect, performance, security, expo-sensors]
module: rides, mobile HUD, API rides service
symptom: "Lean gauge not responding, chart tooltips missing distance data, mileage race condition, sparkline interval resetting, HudControls re-rendering every second"
root_cause: "Multiple anti-patterns: side effects in useDerivedValue, stripped custom properties on chart data, missing user_id defense-in-depth, useEffect deps on fast-changing values"
---

# Ride HUD Redesign: Reanimated Patterns, Chart Tooltips, and Mileage Safety

## Problems Solved

Five distinct issues surfaced during the ride HUD redesign and post-ride mileage feature implementation. Each is a reusable pattern.

---

## 1. react-native-reanimated: Never mutate shared values inside `useDerivedValue`

**Symptom:** Lean angle gauge showed jittery or lagging readings. Peak tracking values updated unpredictably.

**Root cause:** `useDerivedValue` is designed for pure computations. Mutating other shared values (`filteredLean`, `peakLeft`, `peakRight`) inside it creates circular dependencies and unpredictable update ordering in reanimated v4.

**Wrong:**
```tsx
const smoothLean = useDerivedValue(() => {
  const filtered = filteredLean.value + ALPHA * (rawLean.value - filteredLean.value);
  filteredLean.value = filtered; // SIDE EFFECT — bad
  if (filtered < peakLeft.value) peakLeft.value = filtered; // SIDE EFFECT — bad
  return filtered;
});
```

**Correct:**
```tsx
// Pure derivation
const smoothLean = useDerivedValue(() => {
  const filtered = filteredLean.value + ALPHA * (rawLean.value - filteredLean.value);
  filteredLean.value = filtered; // OK for the filter state itself
  return filtered;
});

// Side effects in useAnimatedReaction
useAnimatedReaction(
  () => smoothLean.value,
  (current) => {
    if (current < peakLeft.value) peakLeft.value = current;
    if (current > peakRight.value) peakRight.value = current;
  },
);
```

**Rule:** `useDerivedValue` = pure computation. `useAnimatedReaction` = side effects triggered by value changes.

Also: don't tag functions with `'worklet'` if they're only called from the JS thread (e.g., inside a DeviceMotion listener callback). It's misleading and has no effect.

---

## 2. react-native-gifted-charts: `pointerConfig` preserves custom data properties

**Symptom:** Chart tooltips could only show the Y-value but not the corresponding distance.

**Root cause:** The elevation chart was stripping custom properties before passing data to LineChart:
```tsx
// WRONG — strips dist property needed for tooltip
chartData: data.map((d) => ({ value: d.value }))

// CORRECT — preserves dist for pointerLabelComponent access
chartData: data
```

**Key facts about `pointerConfig`:**
- `hideDataPoints` does NOT conflict with `pointerConfig` — they're independent systems
- `pointerLabelComponent` receives `(items, secondaryItems, pointerIndex)` — the 3rd arg gives the index
- The library preserves ALL custom properties on data items (e.g., `dist`, `elapsedMin`)
- Use `activatePointersOnLongPress: true` when chart is inside a ScrollView/BottomSheet to avoid gesture conflicts
- Define tooltip styles as constants OUTSIDE the component to avoid re-creation during drag (60fps)

---

## 3. Supabase mileage update: defense-in-depth with `user_id` filters

**Symptom:** No immediate exploit, but the mileage update code queried motorcycles and maintenance_tasks by `motorcycle_id` only, without a `user_id` filter.

**Root cause:** The `SUPABASE_USER` client enforces RLS, but if RLS were ever misconfigured or the service refactored to use `SUPABASE_ADMIN`, this would become a privilege escalation.

**Rule:** Always add explicit `.eq('user_id', userId)` to Supabase queries, even when using the RLS-enforced user client. Matches the pattern already used everywhere else in the rides service.

```tsx
// Defense-in-depth: filter by user_id alongside RLS
await this.supabase
  .from('motorcycles')
  .update({ current_mileage: newMileage })
  .eq('id', motorcycleId)
  .eq('user_id', userId); // Always add this
```

Also: sanitize error logging — use `error.message` not the full error object, to avoid leaking query details to log aggregation.

---

## 4. `useEffect` intervals: never depend on fast-changing values

**Symptom:** Sparkline data collection was supposed to fire every 5 seconds, but the interval reset on every GPS update (~1-5s), so it rarely fired.

**Root cause:** `currentSpeed` was in the `useEffect` dependency array, causing the interval to tear down and recreate on every speed change.

**Wrong:**
```tsx
useEffect(() => {
  const interval = setInterval(() => {
    setSpeedHistory(prev => [...prev, currentSpeed]); // stale closure
  }, 5000);
  return () => clearInterval(interval);
}, [isPaused, currentSpeed]); // currentSpeed resets the interval!
```

**Correct:**
```tsx
const currentSpeedRef = useRef(currentSpeed);
currentSpeedRef.current = currentSpeed;

useEffect(() => {
  const interval = setInterval(() => {
    setSpeedHistory(prev => [...prev, currentSpeedRef.current]);
  }, 5000);
  return () => clearInterval(interval);
}, [isPaused]); // stable — only isPaused can restart the interval
```

**Rule:** If a value changes frequently and is only READ inside a timer/interval, use a ref. Only put values in the dependency array if their change should restart the timer.

---

## 5. `useCallback` deps: refs for values only needed at call time

**Symptom:** `HudControls` component re-rendered every second even though its props didn't visually change.

**Root cause:** `handleEndRide` had `elapsedSeconds` in its `useCallback` dependency array. Since the elapsed timer updates every second, the callback was recreated every second, defeating `memo` on `HudControls`.

**Wrong:**
```tsx
const handleEndRide = useCallback(() => {
  // uses elapsedSeconds for route params
  params: { durationS: String(elapsedSeconds) }
}, [endRide, router, elapsedSeconds]); // recreated every second!
```

**Correct:**
```tsx
const elapsedRef = useRef(0);
// In the timer: elapsedRef.current = elapsed;

const handleEndRide = useCallback(() => {
  params: { durationS: String(elapsedRef.current) }
}, [endRide, router]); // stable — only recreated when endRide/router change
```

**Rule:** If a value is only needed when the callback executes (not during render), use a ref. This keeps the callback stable and prevents unnecessary child re-renders.

---

## Prevention Checklist

- [ ] `useDerivedValue` bodies contain only pure computations — no `.value = ` assignments to other shared values
- [ ] `useAnimatedReaction` used for any side effects triggered by shared value changes
- [ ] Chart data items preserve all custom properties when passed to `react-native-gifted-charts`
- [ ] All Supabase queries include `.eq('user_id', userId)` even with RLS-enforced client
- [ ] `useEffect` intervals use refs for frequently-changing values, not deps
- [ ] `useCallback` deps only include values that should trigger callback recreation
- [ ] Error logging uses `error.message` not full error objects
