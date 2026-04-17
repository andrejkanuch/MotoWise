---
status: pending
priority: p3
issue_id: "149"
tags: [code-review, docs, architecture]
dependencies: ["133"]
---

# trip-suggestions module: ownership boundaries invisible from the module graph

## Problem Statement

The sibling placement of `trip-suggestions` alongside `trips` is fine, but its ownership split is not visible from the module graph: it reads from `trips` and `trip_participants` and writes to `trip_suggestions` and `trip_waypoints` (via RLS). The next reviewer has to trace service code to figure this out, which makes future refactors risky.

## Findings

- **Architecture Strategist:** `apps/api/src/modules/trip-suggestions/trip-suggestions.module.ts` — no header comment describing cross-table semantics
- Ties into #133 (broader module-boundary cleanup)

## Proposed Solutions

### Option A: Module header comment (Recommended)
Add a 5-line banner on the module describing reads, writes, and the co-planner semantics:
```ts
// trip-suggestions
// Reads:  trips, trip_participants (via RLS)
// Writes: trip_suggestions, trip_waypoints (via RLS)
// Role:   co-planner surface — suggestions may be promoted to waypoints.
//         See docs/ADR-00NN-trip-coplanning.md.
```
- Effort: Small

## Technical Details

- **Affected files:** `apps/api/src/modules/trip-suggestions/trip-suggestions.module.ts`

## Acceptance Criteria

- [ ] Header comment present and accurate
- [ ] Linked from #133 consolidation work

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | architecture-strategist |
