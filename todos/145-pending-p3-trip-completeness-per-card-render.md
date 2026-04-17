---
status: pending
priority: p3
issue_id: "145"
tags: [code-review, performance, react]
dependencies: []
---

# computeTripCompleteness recomputes per card per render

## Problem Statement

`computeTripCompleteness` is called unmemoised inside each `TripCard` and again in `trips.tsx`. The computation is trivial (~1μs for 4 bool checks), but it allocates 4 objects + 1 array per card per render. On long trip lists with frequent re-renders (scroll, header animation), that's measurable GC pressure on mid-range Android.

## Findings

- **Performance Reviewer:** `apps/mobile/src/components/trip/trip-card.tsx:104-110` and `apps/mobile/src/app/(tabs)/trips.tsx:121-127`

## Proposed Solutions

### Option A: useMemo in the card (Recommended)
```ts
const completeness = useMemo(
  () => computeTripCompleteness({ hasStart, hasEnd, waypointCount, hasNotes }),
  [hasStart, hasEnd, waypointCount, hasNotes],
);
```
- Effort: Small

### Option B: Return `completenessPercent` from the API
Precomputed on the server; zero client allocation. Better if more surfaces need it.
- Effort: Medium

## Technical Details

- **Affected files:** `apps/mobile/src/components/trip/trip-card.tsx`, `apps/mobile/src/app/(tabs)/trips.tsx`, optionally `apps/api/src/modules/trips/*`

## Acceptance Criteria

- [ ] No per-render allocation on stable card props
- [ ] Visual output unchanged
- [ ] Flashlight/Reactotron re-render count confirms memoisation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer |
