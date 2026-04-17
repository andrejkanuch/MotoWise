---
status: pending
priority: p3
issue_id: "150"
tags: [code-review, architecture, mobile, refactor]
dependencies: []
---

# offline-trips.ts couples Mapbox tile-pack mgmt + MMKV payload cache

## Problem Statement

`apps/mobile/src/lib/offline-trips.ts` owns both tile-pack lifecycle (Mapbox `offlineManager`) and trip payload caching (MMKV JSON) through a shared MMKV instance. At ~200 LOC today it's fine, but the coupling will get uncomfortable once a second payload consumer appears (offline ride log, cached weather snapshot, etc.).

## Findings

- **Architecture Strategist:** `apps/mobile/src/lib/offline-trips.ts` — two responsibilities behind one module, shared storage handle

## Proposed Solutions

### Option A: Split on the next consumer (Recommended, tracking only)
When a second payload consumer lands, split into:
- `lib/offline/tile-pack.ts` — Mapbox `offlineManager` wrapper
- `lib/offline/payload-cache.ts` — typed MMKV JSON cache
- `lib/offline/index.ts` — thin façade that re-exports the current API so call sites don't move

No action this PR. Tracking only.
- Effort: Medium (when triggered)

## Technical Details

- **Affected files (future):** `apps/mobile/src/lib/offline-trips.ts` → `apps/mobile/src/lib/offline/*`

## Acceptance Criteria

- [ ] When a second payload consumer is added, ticket is picked up and split lands in the same PR
- [ ] Façade keeps existing call sites stable

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | architecture-strategist |
