---
title: "[#365 T16b] At most one modal sheet per cold session over Home (recall, then Service plan ready; What's New and check-in wait)"
labels: [bug, area:mobile, activation-365]
order: 27
task_id: T16b
depends_on: [T05d]
phase: P1
size: M
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T16 (split b), spec FS-PO17, owner decision D11 (priority).

## Why
5 replays show competing sheets over Home on landing [SOURCE: R6 F-PO17]. `post_onboarding_landed.overlay` cannot count sheets that appear after landing (review item 22).

## What to change
A landing-sheet queue (one owner hook, e.g. `features/landing/use-landing-sheet-queue.ts`) that every sheet owner asks before showing. Ruling D11 (plan §9, amended 2026-11-12):
- **At most one modal sheet per cold session.**
- **Order:** analytics consent is an earlier gate (it is resolved before the queue runs and is not counted as a landing sheet); then (1) safety recall for the rider's bike (`recall-sheet`), then (2) "Service plan ready" — the OEM-imported sheet (`oem-imported-sheet`).
- **Exp 1 plan card** (T32) is an inline Home card, not a sheet; it is shown only when no sheet is shown in that session.
- **What's New and check-in** are not shown in the first session; they become eligible from the next cold session (still one sheet per session).
- Fire fire `landing_sheet_shown {sheet, ms_since_landed, queue_position}` (constant from T05d). testIDs `recall-sheet`, `oem-imported-sheet`, `whats-new-sheet`.

## How
Find each sheet owner (recall, OEM-imported, check-in, What's New gate `features/whats-new/use-whats-new-gate.ts`). Jest: recall + OEM-imported requested → only recall shown, OEM-imported deferred to the next cold session; What's New / check-in requested in the first session → not shown, eligible next session; a sheet shown → the plan card's "may show" selector returns false; no sheet → true. Maestro assertion added to `post-onboarding-landing.yaml`.

## Acceptance criteria
- [ ] Jest passes; ids visible to `inspect_screen` both platforms.
- [ ] `whats-new.yaml` still green; light/dark screenshots.
- [ ] D11 ruling implemented as written (one modal sheet per cold session; order recall → Service plan ready; plan card inline only when no sheet).

## Verification
Maestro log of the landing flow with the sheet assertions.

## Friction spec
FS-PO17. Repro: new account whose bike has a recall and an OEM import; finish onboarding. Expected: only the recall sheet; no OEM-imported or What's New sheet in that session. Automated check: jest (CI) queue test (red first: two shown); maestro (local, both) guard: `post-onboarding-landing.yaml` asserts not more than one of `{id: recall-sheet}`, `{id: oem-imported-sheet}`, `{id: whats-new-sheet}` visible.

## Production metric
First-session riders with ≥ 2 `landing_sheet_shown` within 60 s of `post_onboarding_landed`, by `{REL}`. Baseline unknown (5 replays). Target 0. Tile "FS-PO17 — competing landing sheets". Annotate Release A.

## Release
Release A (lvl 2); the release cut records the level of FS-PO17 in plan §6.1 (no code map).

## Dependencies
- Blocked by: T05d.
- Blocks: T18.

## Out of scope
The onboarding paywall (never part of the queue).

## Constraints
D11; light/dark; Home is Exp 1 territory after launch (log in ledger).
