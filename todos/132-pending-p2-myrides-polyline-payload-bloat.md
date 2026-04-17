---
status: pending
priority: p2
issue_id: "132"
tags: [code-review, performance, graphql]
dependencies: []
---

# MyRides shared query carries routePolyline + region to screens that discard it

## Problem Statement

`apps/mobile/src/graphql/queries/my-rides.graphql:19-20` now selects `routePolyline` and `region` on the shared document. Home screen and rides list don't use them (home explicitly nulls `polyline` at `apps/mobile/src/hooks/use-home-data.ts:119`). Only the heatmap screen needs them.

Cost: ~2–5 KB per ride × 20/page = **40–100 KB wasted per fetch**. A 500-ride rider pays ~2.5 MB of polyline on every heatmap load (legitimate there, pure waste everywhere else).

## Findings

- **Performance Reviewer:** payload bloat on home + rides list; polyline explicitly discarded downstream.
- **Architecture Strategist:** one document serving three screens with different shape needs.

## Proposed Solutions

### Option A: Split into two documents (Recommended)

```graphql
# my-rides.graphql — thin, shared by home + rides list
query MyRides($first: Int!, $after: String) {
  myRides(first: $first, after: $after) {
    edges { node { id startedAt distanceM name } }
    pageInfo { endCursor hasNextPage }
  }
}

# my-rides-for-heatmap.graphql — dedicated, heavy
query MyRidesForHeatmap($first: Int!, $after: String) {
  myRides(first: $first, after: $after) {
    edges { node { id startedAt distanceM name region routePolyline } }
    pageInfo { endCursor hasNextPage }
  }
}
```

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Drop polyline from shared doc, keep inline heatmap doc

If #108 is migrating the heatmap screen to generated types anyway, just strip the heavy fields from the shared document and leave heatmap inline.

## Recommended Action

Option A — stable document names make telemetry and caching easier.

## Technical Details

- **Affected files:** `apps/mobile/src/graphql/queries/my-rides.graphql`, new `my-rides-for-heatmap.graphql`, consumers in heatmap screen, rerun `pnpm generate`

## Acceptance Criteria

- [ ] Home + rides list payload ≤ 0.5 KB/ride
- [ ] Heatmap screen still renders polylines correctly
- [ ] Generated types updated in `packages/graphql`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
- Related: #108 generated-doc migration
