---
title: "[#365 T16b] At most one sheet over Home on first landing (recall / OEM-imported / check-in / What's New queue)"
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
A first-session sheet queue (one owner hook, e.g. `features/landing/use-landing-sheet-queue.ts`) that every sheet owner asks before showing; at most one in the first session, priority per D11; fire `landing_sheet_shown {sheet, ms_since_landed, queue_position}` (constant from T05d). testIDs `recall-sheet`, `oem-imported-sheet`, `whats-new-sheet`.

## How
Find each sheet owner (recall, OEM-imported, check-in, What's New gate `features/whats-new/use-whats-new-gate.ts`). Jest: two sheets requested → one shown, the other deferred to the next session. Maestro assertion added to `post-onboarding-landing.yaml`.

## Acceptance criteria
- [ ] Jest passes; ids visible to `inspect_screen` both platforms.
- [ ] `whats-new.yaml` still green; light/dark screenshots.
- [ ] D11 recorded.

## Verification
Maestro log of the landing flow with the sheet assertions.

## Friction spec
FS-PO17. Repro: new account whose bike has a recall and an OEM import; finish onboarding. Expected: at most one sheet. Automated check: jest (CI) queue test (red first: two shown); maestro (local, both) guard: `post-onboarding-landing.yaml` asserts not more than one of `{id: recall-sheet}`, `{id: oem-imported-sheet}`, `{id: whats-new-sheet}` visible.

## Production metric
First-session riders with ≥ 2 `landing_sheet_shown` within 60 s of `post_onboarding_landed`, by `{REL}`. Baseline unknown (5 replays). Target 0. Tile "FS-PO17 — competing landing sheets". Annotate Release A.

## Release
Release A; `FS-PO17: 2`.

## Dependencies
- Blocked by: T05d.
- Blocks: T18.

## Out of scope
The onboarding paywall (never part of the queue).

## Constraints
D11; light/dark; Home is Exp 1 territory after launch (log in ledger).
