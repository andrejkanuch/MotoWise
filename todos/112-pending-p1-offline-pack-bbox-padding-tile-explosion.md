---
status: pending
priority: p1
issue_id: "112"
tags: [code-review, mapbox, performance, cost]
dependencies: []
---

# Offline pack bbox padding causes tile explosion (cost + device storage)

## Problem Statement

`bboxFromPoints` pads by 0.05° and `downloadOfflinePack` covers z8–z14. For a 3-day, ~400 km trip that expands to ~55k tiles ≈ 825 MB–1.6 GB per pack. Mapbox free tier allows 750 MAU tile packs; paid tier is $0.15/1k tiles after — a single big trip eats ~$8 of quota and fills the user's phone. No size preview is shown before the user taps "Download."

## Findings

- **performance-oracle:** `apps/mobile/src/lib/offline-trips.ts:27` (bbox pad), `:182` (zoom range).

## Proposed Solutions

### Option A: Route-corridor packs + zoom clamp + size preview (Recommended)
Build one small padded bbox per waypoint (e.g. ±3 km), merge into a single multi-polygon, clamp `maxZoom` to 12 for highway zoom levels, and display estimated tile count + MB in the confirm sheet before starting the download.
- Pros: 10–20× fewer tiles for long trips; user consents with full info; stays well under Mapbox free tier.
- Cons: More bbox math; slight loss of off-route detail.
- Effort: Medium
- Risk: Medium

### Option B: Dynamic padding based on bbox area
Keep the single-bbox model but shrink padding proportionally for large bboxes.
- Pros: Smaller diff.
- Cons: Still downloads off-route rural tiles; no cost preview.
- Effort: Small
- Risk: Low

## Recommended Action

Option A — route-corridor packs are the correct shape for this data and users should see the size before committing to a multi-hundred-MB download.

## Technical Details

- **Affected files:** `apps/mobile/src/lib/offline-trips.ts`, whichever confirm sheet calls `downloadOfflinePack` (likely under `apps/mobile/src/app/(tabs)/trips/`).
- **Database changes:** No.

## Acceptance Criteria

- [ ] A 3-day 400 km trip generates <5k tiles at default settings.
- [ ] Download confirm sheet shows estimated tile count and MB.
- [ ] `maxZoom` never exceeds 12 without explicit user override.
- [ ] Manual test: download a 100 km trip — pack is <100 MB.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-oracle |

## Resources

- Branch: feat/impeccable-discover-redesign
