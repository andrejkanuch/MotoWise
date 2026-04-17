---
status: pending
priority: p3
issue_id: "146"
tags: [code-review, performance, mobile]
dependencies: []
---

# Offline download progress callback re-renders on every Mapbox tick

## Problem Statement

Mapbox fires progress 50–300 times per offline pack download; each call goes through `setProgress` in `useOfflineTrip`, re-rendering `OfflinePackButton`. Accumulated JS-thread work is roughly 100ms–1.5s during a phase when the native thread is already busy decoding tiles. Result: jank on low-end devices and a visible stutter on the download button itself.

## Findings

- **Performance Reviewer:** `apps/mobile/src/hooks/use-offline-trip.ts:56` + `apps/mobile/src/lib/offline-trips.ts:124-142`

## Proposed Solutions

### Option A: Throttle in the callback (Recommended)
Only call `setProgress` when `percentage - lastReported >= 1` or when state transitions to `Complete`/`Error`. Keeps the progress bar visually smooth at 100 updates.
```ts
if (state === 'Complete' || percentage - lastReportedRef.current >= 1) {
  lastReportedRef.current = percentage;
  setProgress({ percentage, state });
}
```
- Effort: Small

### Option B: Reanimated shared value
Drive the progress bar from a `useSharedValue` set outside React's commit loop. Best perf, slightly more code.
- Effort: Medium

## Technical Details

- **Affected files:** `apps/mobile/src/hooks/use-offline-trip.ts`, `apps/mobile/src/lib/offline-trips.ts`, `apps/mobile/src/components/offline/offline-pack-button.tsx`

## Acceptance Criteria

- [ ] Max ~101 renders per download (or zero under Option B)
- [ ] No visual regression on the progress bar
- [ ] Terminal `Complete`/`Error` states still fire promptly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-16 | Created from /ce-review | performance-reviewer |
