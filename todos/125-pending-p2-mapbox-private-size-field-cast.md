---
status: pending
priority: p2
issue_id: "125"
tags: [code-review, typescript, mapbox]
dependencies: []
---

# Mapbox offline pack size read from private `_size` field

## Problem Statement

`apps/mobile/src/lib/offline-trips.ts:150` reaches into a Mapbox SDK private field:

```ts
const sizeBytes = (finished as unknown as { _size?: number })._size ?? 0;
```

Any `@rnmapbox/maps` bump can silently rename or drop `_size` — the cast will keep typechecking but return `undefined`, and the bug surfaces as corrupt size data in the cache, not a build failure.

## Findings

- **Kieran TypeScript Reviewer:** `as unknown as` escape hatch against a private field.
- **Reliability Reviewer:** no fallback; `?? 0` masks the drift.

## Proposed Solutions

### Option A: Localise the unsafety in a helper and stop persisting size (Recommended)

```ts
function getPackSize(pack: OfflinePack): number | undefined {
  const anyPack = pack as unknown as { _size?: number };
  return typeof anyPack._size === 'number' ? anyPack._size : undefined;
}
```

Call sites get a typed `number | undefined` and a single line to update on SDK bump. Better still: don't persist `sizeBytes` in MMKV — re-derive at render time from `offlineManager.getPacks()` so there's no cached drift.

- Pros / Cons / Effort: Small / Risk: Low

### Option B: Upstream a public `size` getter

Open a PR on `@rnmapbox/maps` exposing `size`. Longest-term fix, slowest to land.

## Recommended Action

Option A now; nominate Option B as a backlog item.

## Technical Details

- **Affected files:** `apps/mobile/src/lib/offline-trips.ts`, any consumer reading `sizeBytes`

## Acceptance Criteria

- [ ] Single `getPackSize` helper owns the cast
- [ ] `sizeBytes` either derived on demand or explicitly tolerates `undefined`
- [ ] Test: mock pack without `_size` returns `undefined`, UI shows "—" not "0 B"

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | kieran-typescript-reviewer |

## Resources

- Branch: feat/impeccable-discover-redesign
