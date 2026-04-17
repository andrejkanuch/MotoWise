---
status: pending
priority: p1
issue_id: "109"
tags: [code-review, react, performance, render]
dependencies: []
---

# Heatmap screen calls fetchNextPage() in render body

## Problem Statement

`fetchNextPage()` is invoked directly in the component body of the heatmap screen — a render-time side effect that double-fires under React 19 strict mode and re-triggers every time a page lands. For a 500-ride rider this eagerly pulls 10 pages (~1–2.5 MB JSON) and re-runs `buildHeatmapFeatureCollection` on every page, adding ~300 ms of cumulative JS blocking time on a mid-range device.

## Findings

- **kieran-typescript-reviewer:** `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx:103-105` — side effect in render body.
- **performance-oracle:** concurs; flagged cumulative blocking + memory on power users.

## Proposed Solutions

### Option A: useEffect + hard page cap (Recommended)
Move the pagination trigger into an effect with a cap so power users don't OOM.

```tsx
useEffect(() => {
  if (allRides.length < 500 && hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [allRides.length, hasNextPage, isFetchingNextPage, fetchNextPage]);
```
- Pros: Fixes double-fire + caps memory; minimal diff.
- Cons: Users with >500 rides miss old data (acceptable for a heatmap).
- Effort: Small
- Risk: Low

### Option B: Explicit "Load more" button
Render the first page; user taps to extend.
- Pros: Fully user-driven, zero runaway cost.
- Cons: Degrades the heatmap's "show my whole life" feel.
- Effort: Small
- Risk: Low

## Recommended Action

Option A — keeps the eager feel while fixing the strict-mode double-fire and capping memory.

## Technical Details

- **Affected files:** `apps/mobile/src/app/(tabs)/(profile)/heatmap.tsx`.
- **Database changes:** No.

## Acceptance Criteria

- [ ] No `fetchNextPage()` call in render body.
- [ ] React 19 strict mode double-render does not double-fetch.
- [ ] Pagination halts at ≥500 rides even if `hasNextPage` is still true.
- [ ] Manual test with a >500-ride account doesn't exceed ~5 MB heap growth during scroll-in.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | kieran-typescript-reviewer, performance-oracle |

## Resources

- Branch: feat/impeccable-discover-redesign
