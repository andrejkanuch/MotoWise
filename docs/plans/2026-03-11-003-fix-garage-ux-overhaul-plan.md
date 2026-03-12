---
title: "Garage UX Overhaul — P0 Critical Fixes"
type: fix
status: completed
date: 2026-03-11
---

# Garage UX Overhaul — P0 Critical Fixes

## Overview

Fix six critical UX and engineering issues in the Garage section: broken FAB route, inconsistent route paths, Health Score Ring text overflow at small sizes, edit sheet blank space, and replace ambiguous FABs with contextual inline actions on both the garage list and bike detail screens.

## Problem Statement

The Garage section has accumulated seven issues (P1-P7). This plan covers only the P0 must-haves:

- **P6** — Broken FAB route: `/(tabs)/(garage)/add-task` doesn't exist (should be `add-maintenance-task`)
- **P7** — Inconsistent route paths: missing `(tabs)` prefix in garage list navigation
- **P3** — Health score ring text overflows at `size={64}` (hardcoded fontSize: 32)
- **P2** — Edit sheet has massive blank space (85% detent + KeyboardAvoidingView)
- **P1** — Ambiguous FAB on garage list (replace with inline button)
- **P1** — Ambiguous FAB on bike detail (replace with quick action bar + More menu)

## Implementation Phases

### Phase 1: Route Fixes (~15 min)

- [ ] Fix `bike/[id].tsx` line 1314: change `/(tabs)/(garage)/add-task` to `/(tabs)/(garage)/add-maintenance-task`
- [ ] Fix `index.tsx` line 339: change `/(garage)/add-bike` to `/(tabs)/(garage)/add-bike`
- [ ] Fix `index.tsx` line 377: change `/(garage)/bike/${bike.id}` to `/(tabs)/(garage)/bike/${bike.id}`
- [ ] Fix `index.tsx` line 387: change `/(garage)/add-bike` to `/(tabs)/(garage)/add-bike`

### Phase 2: HealthScoreRing Fix (~30 min)

- [ ] Scale `STROKE_WIDTH` proportionally: `STROKE_WIDTH * (size / SIZE)`
- [ ] Scale score fontSize: `Math.max(14, Math.round(32 * scale))` where `scale = size / SIZE`
- [ ] Scale grade fontSize: `Math.max(9, Math.round(13 * scale))`
- [ ] Scale marginTop proportionally: `Math.round(-2 * scale)`
- [ ] Scale "No Data" fontSize proportionally
- [ ] Clamp score to 0-100 range before animation

### Phase 3: Edit Sheet Fix (~15 min)

- [ ] Change `_layout.tsx` edit-bike `sheetAllowedDetents` from `[0.85, 1.0]` to `[0.55, 0.85]`
- [ ] Remove `KeyboardAvoidingView` wrapper in `edit-bike.tsx`
- [ ] Add `keyboardDismissMode="interactive"` to ScrollView

### Phase 4: Replace FABs with Contextual Actions (~2 hrs)

#### Garage List
- [ ] Remove FAB (lines 382-412 in `index.tsx`)
- [ ] Add inline "Add Motorcycle" button below the count text
- [ ] Style as outlined/secondary button with Plus icon

#### Bike Detail
- [ ] Remove FAB (lines 1309-1332 in `bike/[id].tsx`)
- [ ] Build `QuickActionBar` component with labeled pill buttons: "+ Task", "More"
- [ ] Place below stat cards section
- [ ] "More" opens ActionSheet with: Edit Bike, Export PDF, Delete Motorcycle
- [ ] Remove bottom-of-page Export PDF button (moved to More menu)
- [ ] Remove bottom-of-page Delete button (moved to More menu)

## Files to Modify

| File | Changes |
|------|---------|
| `apps/mobile/src/app/(tabs)/(garage)/bike/[id].tsx` | Fix FAB route, remove FAB, add QuickActionBar, remove bottom buttons |
| `apps/mobile/src/app/(tabs)/(garage)/index.tsx` | Fix routes, remove FAB, add inline button |
| `apps/mobile/src/components/HealthScoreRing.tsx` | Scale all dimensions proportionally |
| `apps/mobile/src/app/(tabs)/(garage)/_layout.tsx` | Change edit-bike detent |
| `apps/mobile/src/app/(tabs)/(garage)/edit-bike.tsx` | Remove KeyboardAvoidingView |

## Acceptance Criteria

- [ ] All garage list navigation works with `(tabs)` prefix
- [ ] Bike detail FAB navigates to correct `add-maintenance-task` route
- [ ] HealthScoreRing renders correctly at sizes 48, 64, 80, 100, 140
- [ ] Edit bike sheet opens at ~55% height with no blank space
- [ ] No floating elements on either garage list or bike detail
- [ ] All actions (add bike, add task, edit, export, delete) are accessible

## Sources

- Route mismatch: `bike/[id].tsx:1314`
- HealthScoreRing: `components/HealthScoreRing.tsx` (hardcoded fontSize: 32, 13)
- Edit sheet: `_layout.tsx:66` (sheetAllowedDetents: [0.85, 1.0])
- Edit sheet KAV: `edit-bike.tsx:107` (KeyboardAvoidingView wrapper)
- Garage list FAB: `index.tsx:382-412`
- Bike detail FAB: `bike/[id].tsx:1309-1332`
