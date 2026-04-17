---
status: pending
priority: p2
issue_id: "129"
tags: [code-review, performance, network]
dependencies: []
---

# Discover cold-start fires 5–6 GraphQL round-trips

## Problem Statement

On cold open with empty chips, Discover fires: `discoverRoutes` + editor's picks + weekend + season + savedRoutes + becauseYouLiked — **5–6 round-trips** totalling ~50–60 routes (60–120 KB) in 200–600 ms p50 on LTE. Editor's picks and weekend likely overlap. This is the slowest first-meaningful-paint in the tab bar.

## Findings

- **Performance Reviewer:** 5–6 concurrent queries on mount from Discover index.
- **Performance Reviewer:** no batching, no lazy-mount by viewport.

## Proposed Solutions

### Option A: Single `discoverBundle` query (Recommended)

Add a resolver on the API that returns all carousels in one call:

```graphql
query DiscoverBundle($filter: DiscoverFilterInput!) {
  discoverBundle(filter: $filter) {
    forYou { ...RouteCard }
    editorsPicks { ...RouteCard }
    weekend { ...RouteCard }
    seasonal { ...RouteCard }
    becauseYouLiked { ...RouteCard }
  }
}
```

Service composes the sub-fetches in parallel with `Promise.all`, dedupes overlaps. One round-trip, smaller payload, stronger cache key.

- Pros / Cons / Effort: Medium / Risk: Low

### Option B: Lazy-mount below the fold (Interim)

Keep queries separate but mount sections only when `onViewableItemsChanged` reports them in view. Ships today, smaller change, but still multiple trips once user scrolls.

- Effort: Small / Risk: Low

## Recommended Action

Option B immediately. Plan Option A as the durable fix.

## Technical Details

- **Affected files:** `apps/mobile/src/app/(tabs)/(discover)/index.tsx`, `apps/api/src/modules/discover/*`, `apps/mobile/src/graphql/queries/discover-*.graphql`, `packages/graphql` regeneration

## Acceptance Criteria

- [ ] Cold-start network panel shows ≤ 2 GraphQL calls (1 bundle + 1 user)
- [ ] Payload ≤ 80 KB on cold start
- [ ] No regression in carousel hydration

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
