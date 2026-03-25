---
status: complete
priority: p2
issue_id: "104"
tags: [code-review, performance, currency]
dependencies: []
---

# Preference hydration triggers unnecessary AsyncStorage writes on every app-focus

## Problem Statement

In `_layout.tsx`, two `useEffect` hooks hydrate `currency` and `measurementSystem` from the `me` query. They fire on every TanStack Query refetch (including `refetchOnWindowFocus`), calling `setCurrency()`/`setMeasurementSystem()` even when the value hasn't changed. Zustand's `persist` middleware serializes and writes to AsyncStorage on every `set()` call.

## Findings

- **Location**: `apps/mobile/src/app/_layout.tsx` lines 96-107
- **Impact**: Two unnecessary AsyncStorage writes per app-focus cycle on Android

## Proposed Solutions

1. Guard against no-op writes: `if (serverCurrency && serverCurrency !== useAuthStore.getState().currency)`
2. Merge both effects into one
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Hydration effects only write to store when value has actually changed
- [ ] Both effects merged into a single `useEffect`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-24 | Identified during performance review | |
