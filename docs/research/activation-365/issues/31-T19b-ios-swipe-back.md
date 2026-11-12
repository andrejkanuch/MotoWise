---
title: "[#365 T19b] iOS: swipe-back cannot rewind onboarding past the account step"
labels: [enhancement, area:mobile, activation-365]
order: 31
task_id: T19b
depends_on: [T00, T04b]
phase: P2
size: S
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3A.2 (new, review item 19), spec FS-OB1b (iOS), D1.

## Why
iOS back-walkers: **14/72 (19.4%)**, a higher share than Android, 2 completed [SOURCE: V1-q15; R1 Q8 had 15/70].

## What to change
`gestureEnabled: false` on onboarding steps after the account step in `app/(onboarding)/_layout.tsx:42-64`; the in-screen back button stays and steps one screen (fires `onboarding_back {trigger:'button'}`). Steps before account keep the swipe.

## How
Jest: layout options per route. Maestro `onboarding-ios-swipe-back.yaml` (iOS sim): after account, `swipe` from left edge → still on the same step.

## Acceptance criteria
- [ ] Red run on main (swipe goes back), green after on iOS sim.
- [ ] Ledger date (D1).

## Verification
Maestro log (iOS sim); `pnpm verify:mobile`.

## Friction spec
FS-OB1b (iOS). Repro: iOS sim, past account, edge-swipe ×3. Expected: stays on the step; back button still works one step. Automated check: maestro (local, iOS sim) `swipe: {start: "2%,50%", end: "80%,50%"}` → `assertVisible` current step title. Red first.

## Production metric
FS-OB1b SQL, platform ios, `trigger IN ('gesture','button')`. Baseline 14/72 (19.4%) (`$screen` method, `validation/V1-metrics.md` §3.2) [SOURCE: V1-q15]. Target ≤ 8% [UNBACKED — own target]. Tile shared with T19a. Annotate Release B.

## Release
Release B; `FS-OB1b: 3`.

## Dependencies
- Blocked by: T00 (test environment), T04b.
- Blocks: T35.

## Out of scope
Android (T19a).

## Constraints
D1; light/dark n/a (no visual change).
