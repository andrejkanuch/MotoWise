---
title: "[#365 T27] Start Ride first open: clear Start, bike preselected, permission in context, denial never a silent spinner"
labels: [enhancement, area:mobile, activation-365]
order: 40
task_id: T27
depends_on: [T05c]
phase: P2
size: M
release_path: "Release B 3.30.0 — launch-day both-arm change (ledger), mechanical metrics only"
---

## Context
#365, plan §3 T27, §3A.0 rule 7 (review item 29), spec FS-PO14, D12.

## Why
67 of 130 completers who opened Start Ride on day 0 did not start (52%); replays: setup-screen exits, a spinner, a denied-permission return [SOURCE: R6 F-PO14, R6-q9]. Denied location should show "Location required" (`app/(modals)/start-ride.tsx:99-102`); start flow `:81-148`.

## What to change
First: diagnose with `$screen` + last-tap data (record in `experiments.md`). Then: Start above the fold, onboarding bike preselected, in-context permission once, denied → alert with Open Settings (never a spinner), one line "Short test rides aren't saved (under {{seconds}} s or {{meters}} m)" (shared interpolation with T31). testIDs `start-ride-bike-preselected`, `start-ride-location-required`.

## How
Jest `app/(modals)/__tests__/start-ride.test.tsx` (`{reason:'denied'}` → alert + busy cleared). Maestro `start-ride-first-open.yaml` (deny and allow runs).

## Acceptance criteria
- [ ] Red run (deny → spinner) on main, green after; light/dark (setup screen; HUD stays dark); 7 locales.
- [ ] Ledger: launch-day both-arm change with date.

## Verification
Maestro logs (local, both).

## Friction spec
FS-PO14. Repro: new account, location not asked; Home → Start Ride; deny, then allow. Expected: Start visible, bike preselected, denial → alert. Automated check: maestro (local, both) `launchApp: {permissions: {location: deny}}` → `tapOn: {id: tab-ride-fab}` → `assertVisible: {id: start-ride-button}` → tap → `assertVisible: {id: start-ride-location-required}`; second run allow + `setLocation` → `assertVisible: {id: ride-hud-root}`. Red first.

## Production metric
Completers with a `start-ride` `$screen` on day 0 and no `ride_started` that day, by `{REL}` (draft per R6-q9). Baseline 67/130 (52%) [SOURCE: R6-q9]. Target ≤ 35% (test arm: subtract `next_ride_plan_set` riders). Tile "FS-PO14 — Start Ride opened, no ride". Annotate Release B.

## Release
Release B; `FS-PO14: 3`.

## Dependencies
- Blocked by: T05c.
- Blocks: T35.

## Out of scope
Ride floors.

## Constraints
D12; `HUD_THEME`; ride recording free; light/dark.
