---
title: "Diagnosis Flow v2 — Review Findings: Double Haptics, Render Side-Effects, Stale Closures"
category: ui-bugs
date: 2026-03-15
tags: [react-native, zustand, haptics, useEffect, react-19, reanimated, expo]
module: diagnostic-flow
symptom: "Double haptic feedback on chip toggle, infinite useEffect re-runs, React 19 Strict Mode warnings"
root_cause: "Haptics fired in both Zustand store action and UI component; side-effect during render body; useShallow creating new references each render"
---

## Problem

During code review of the Diagnosis Flow v2 redesign (PR #27), three interrelated bugs were found in the diagnostic wizard components.

### 1. Double Haptics on Chip Toggle

Both `toggleWizardOption` in the Zustand store AND `handlePress` in `WizardOptionChip` called `Haptics.impactAsync()`, causing a noticeable double-vibration on every selection.

### 2. Render-Time Side Effect in StepBikeSelection

Pre-selecting the primary bike was called directly in the component render body:

```typescript
// BAD — runs during render, breaks React 19 Strict Mode
if (!store.selectedMotorcycleId && motorcycles.length > 0) {
  const primary = motorcycles.find((m) => m.isPrimary) ?? motorcycles[0];
  if (primary) store.setSelectedMotorcycleId(primary.id);
}
```

### 3. Infinite useEffect from useShallow Reference

Wrapping the side-effect in `useEffect` with the `store` object (from `useShallow`) as a dependency caused infinite re-runs, because `useShallow` returns a new object reference each render.

## Root Cause

1. **Double haptics**: No single ownership of haptic feedback. The store (data layer) and chip (UI layer) both assumed responsibility.
2. **Render side-effect**: Pre-selection logic was placed in the render body instead of an effect, violating React's rule that renders must be pure.
3. **useShallow references**: `useShallow` creates a new object each render (even if values are equal), so using it as a `useEffect` dependency triggers infinite loops.

## Solution

### Haptics: Single ownership in UI layer

Removed `Haptics` import and calls from the Zustand store. Haptics belong in the UI component that handles the press — the chip component already fires them in `handlePress`.

### Render side-effect: Move to useEffect with getState()

```typescript
// GOOD — effect with stable dependency, reads store directly
useEffect(() => {
  const s = useDiagnosticFlowStore.getState();
  if (
    !s.selectedMotorcycleId &&
    !s.manualBikeInfo &&
    !s.showManualForm &&
    motorcycles.length > 0
  ) {
    const primary = motorcycles.find((m) => m.isPrimary) ?? motorcycles[0];
    if (primary) s.setSelectedMotorcycleId(primary.id);
  }
}, [motorcycles]);
```

Key pattern: `useDiagnosticFlowStore.getState()` returns a stable reference to the current store state without subscribing to re-renders, avoiding the stale closure / infinite loop problem.

### Also fixed

- Removed deprecated props (`isIDontKnow`, `icon: ReactNode`) from `WizardOptionChip`
- Moved `ALL_PREDEFINED` Set from component body to module scope (was rebuilt every render)
- Fixed gradient color: `rgba(15,23,42,0)` not `'transparent'` (transparent = transparent black, causes flash)
- Removed redundant ternary: `store.submitError ? onSubmit : onSubmit` → `onSubmit`

## Prevention

**Zustand + useEffect pattern**: When you need to read Zustand state inside a `useEffect` without depending on it, use `store.getState()` instead of the hook's return value. This avoids both stale closures and infinite re-render loops from `useShallow`.

**Haptics ownership rule**: Haptic feedback should live in exactly one place — the UI component that handles the user interaction. Never put haptics in state management actions, as multiple UI paths may call the same action.
