---
status: pending
priority: p3
issue_id: "141"
tags: [code-review, security, input-validation]
dependencies: []
---

# Marker deep-link helpers don't validate lat/lng finiteness

## Problem Statement

`openAppleMaps` passes `lat`/`lng` straight into URL strings. `title` is `encodeURIComponent`'d but numeric fields aren't guarded against `NaN`, `Infinity`, or out-of-range values that could arrive from a corrupted offline cache or malformed GraphQL payload. Low real-world impact, but a trivial guard kills an entire class of bad-URL / crashy-Maps scenarios.

## Findings

- **Correctness Reviewer:** `apps/mobile/src/utils/marker-action-sheet.ts:17-25` (openAppleMaps) — no numeric validation
- Same pattern appears in `apps/mobile/src/utils/nav-handoff.ts` `fmt()`

## Proposed Solutions

### Option A: Shared guard helper (Recommended)
```ts
const isValidCoord = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
if (!isValidCoord(lat, lng)) return;
```
Apply in both `marker-action-sheet.ts` and `nav-handoff.ts`.
- Effort: Small

## Technical Details

- **Affected files:** `apps/mobile/src/utils/marker-action-sheet.ts`, `apps/mobile/src/utils/nav-handoff.ts`

## Acceptance Criteria

- [ ] Invalid coords no-op instead of opening broken Maps URLs
- [ ] Unit test covers NaN, Infinity, lat=95, lng=-181

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | correctness-reviewer |
