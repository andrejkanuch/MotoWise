---
status: pending
priority: p1
issue_id: "111"
tags: [code-review, performance, mapbox, render]
dependencies: []
---

# Heatmap GeoJSON FeatureCollection is rebuilt on every page settle

## Problem Statement

The heatmap's `useMemo` depends on `allRides`, which is a fresh `flatMap` result after each `fetchNextPage` settle — so the FeatureCollection reference changes on every page. For 500 rides × ~200 points that's ~1.6 MB of JSON crossing the JSI bridge per page load, and `ShapeSource` rebuilds its tile buffers each time — ~60–120 ms of native-thread jank per settle.

## Findings

- **performance-oracle:** `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx:112` (memo dep), `:227` (ShapeSource shape prop).

## Proposed Solutions

### Option A: Mutable ref + append-only (Recommended)
Track the last processed page index with `useRef`, maintain a mutable `FeatureCollection` that only gets new features appended, and pass the stable ref to `ShapeSource`. Use a version counter in state to trigger a re-render only when needed.
- Pros: O(new features) work per page instead of O(all); stable shape reference keeps Mapbox tile cache warm.
- Cons: Slightly trickier ergonomics than `useMemo`; must be careful with React key identity for Mapbox to actually pick up updates.
- Effort: Medium
- Risk: Medium

### Option B: Defer rendering until paging completes
Only render `ShapeSource` after `!hasNextPage`; show a skeleton/progress UI while paging.
- Pros: Trivially correct; one rebuild.
- Cons: User sees no map until all pages load (bad UX for slow networks).
- Effort: Small
- Risk: Low

## Recommended Action

Option A — appending is the right model for append-only paginated data and preserves progressive rendering. Depends on #109 being fixed first so paging is actually bounded.

## Technical Details

- **Affected files:** `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx`.
- **Database changes:** No.

## Acceptance Criteria

- [ ] FeatureCollection identity is stable across same-page re-renders.
- [ ] Only new rides from the latest page are iterated per settle.
- [ ] Frame profile during paging shows no >16 ms native-thread stalls on a recent iPhone.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-oracle |

## Resources

- Branch: feat/impeccable-discover-redesign
