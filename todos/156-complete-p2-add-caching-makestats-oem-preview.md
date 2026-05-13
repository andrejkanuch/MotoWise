---
status: complete
priority: p2
issue_id: "156"
tags: [code-review, performance, api]
dependencies: []
---

# Add in-memory caching to makeStats and oemSchedulesPreview

## Problem Statement

Both `makeStats` and `oemSchedulesPreview` return static/slow-changing data but hit Supabase on every request. During concurrent onboarding load (marketing push), this saturates the connection pool (Supabase default 15-20 connections).

## Findings

- **Performance Oracle:** 100 concurrent onboarding users = 100 full-table scans + 100-300 OEM queries. Connection pool pressure well beyond typical limits.

## Proposed Solutions

### Option A: In-memory TTL cache (Recommended)
Follow the existing `NhtsaService` caching pattern:
- `makeStats`: 15-minute TTL (changes only when users add/remove bikes)
- `oemSchedulesPreview`: 1-hour TTL, keyed by `make|model|year` (changes only during migrations)
- Effort: Low
- Risk: None — bounded dataset (~820 OEM rows, ~50 makes)

## Technical Details

- **Affected files:** `apps/api/src/modules/motorcycles/motorcycles.service.ts`, `apps/api/src/modules/oem-schedules/oem-schedules.service.ts`

## Acceptance Criteria

- [ ] `getMakeStats()` cached with 15-min TTL
- [ ] `findByMotorcycle()` cached with 1-hr TTL for preview use case
- [ ] Cache follows existing NhtsaService pattern
