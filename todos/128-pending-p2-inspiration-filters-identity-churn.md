---
status: pending
priority: p2
issue_id: "128"
tags: [code-review, performance, react]
dependencies: []
---

# Inspiration filters hook churns identities every render

## Problem Statement

`apps/mobile/src/hooks/use-inspiration-filters.ts:64-102` returns a fresh object literal every render and calls `new Date()` inside the hook body — the Date is a new instance per render. `headerComponent`'s `useMemo` in `apps/mobile/src/app/(tabs)/(discover)/index.tsx:274` depends on this object, so it invalidates on every render → `DiscoverHeader` re-mounts → all three `HorizontalRouteSection`s re-subscribe TanStack Query. On a 60 fps scroll that's ~4–8 ms/frame of avoidable JS.

## Findings

- **Performance Reviewer:** unstable object identity cascades into child re-subscriptions.
- **Performance Reviewer:** `new Date()` in render path breaks memo stability even if other deps match.

## Proposed Solutions

### Option A: Memoise return, move Date outside render (Recommended)

```ts
export function useInspirationFilters(savedRoutes: SavedRoute[]) {
  const month = useMemo(() => new Date().getMonth(), []);
  const season = SEASON_BY_MONTH[month]; // see #124
  const weekend = useMemo(() => getUpcomingWeekend(), []);
  const becauseYouLiked = useMemo(
    () => buildBecauseYouLiked(savedRoutes),
    [savedRoutes],
  );
  return useMemo(
    () => ({ season, weekend, becauseYouLiked }),
    [season, weekend, becauseYouLiked],
  );
}
```

- Pros / Cons / Effort: Small / Risk: Low

### Option B: React Compiler / automatic memoisation

If the repo adopts React Compiler, this resolves implicitly. Out of scope now.

## Recommended Action

Option A. Pair with #124 (season table) and #129 (query fanout).

## Technical Details

- **Affected files:** `apps/mobile/src/hooks/use-inspiration-filters.ts`, `apps/mobile/src/app/(tabs)/(discover)/index.tsx`

## Acceptance Criteria

- [ ] Hook's return value has stable reference when inputs unchanged
- [ ] `DiscoverHeader` does not re-mount on scroll (verified via key tracking or React DevTools Profiler)
- [ ] Frame time measured ≥ 2 ms lower on a mid-range device during discover scroll

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
