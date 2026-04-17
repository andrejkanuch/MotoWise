---
status: pending
priority: p1
issue_id: "110"
tags: [code-review, react, tanstack-query]
dependencies: []
---

# Trip-suggestion accept invalidates every query keyed 'trip'

## Problem Statement

`qc.invalidateQueries({ queryKey: ['trip'] })` at `apps/mobile/src/hooks/use-trip-suggestions.ts:163` matches every TanStack Query whose first key segment is the string `'trip'` — trip list, trip detail across all trips, nearby trips, anything. Accepting a single suggestion therefore refetches unrelated screens. It also hand-codes the key instead of using the shared `queryKeys` helper, so future key changes silently miss this call site.

## Findings

- **kieran-typescript-reviewer:** `apps/mobile/src/hooks/use-trip-suggestions.ts:163` — overly-broad invalidation + hard-coded key string.

## Proposed Solutions

### Option A: Scoped invalidation via queryKeys helper (Recommended)
Capture `tripId` in the mutation closure and invalidate only the two affected keys:

```ts
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ['trip-suggestions', tripId] });
  qc.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
},
```
- Pros: Fixes unrelated refetch; co-located with other `queryKeys` usage.
- Cons: Requires `queryKeys.trips.detail` to exist (see Option B dependency).
- Effort: Small
- Risk: Low

### Option B: Add missing helper
If `queryKeys.trips.detail` isn't there, add it to `apps/mobile/src/lib/query-keys.ts` alongside existing namespaces.
- Pros: Centralizes trip keys for future call sites.
- Cons: None — this is a sub-task of A.
- Effort: Small
- Risk: Low

## Recommended Action

Option A, with Option B as a prerequisite if the helper is missing.

## Technical Details

- **Affected files:** `apps/mobile/src/hooks/use-trip-suggestions.ts`, possibly `apps/mobile/src/lib/query-keys.ts`.
- **Database changes:** No.

## Acceptance Criteria

- [ ] Accepting a suggestion refetches only that trip's detail + its suggestion list.
- [ ] No hard-coded `['trip']` string remains in this hook.
- [ ] Unrelated `useQuery({ queryKey: queryKeys.trips.list() })` does not refetch (verified via React Query devtools / logger).

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | kieran-typescript-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
