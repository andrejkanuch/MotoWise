---
title: "[#365 T41b] Verify PO15 (receipt scan fallback) and PO16 (trip missing in My trips) and decide"
labels: [research, area:mobile, area:analytics, activation-365]
order: 57
task_id: T41b
depends_on: [T02]
phase: P4
size: S
release_path: "research; fixes, if any, become their own issues"
---

## Context
#365, plan §5A.3 (FS-PO15, FS-PO16), review item 20. Both "not doing now", 1 replay each [SOURCE: R6 F-PO15, F-PO16].

## Why
Every friction must be verifiable even when not fixed now.

## What to change
1. Confirm event names in `features/receipt-scan/use-scan-flow.ts`; write FS-PO15 SQL (scan started → manual form) and run it read-only.
2. Try to reproduce PO16 (Discover → plan → save → My trips); if reproduced, propose `trips_list_viewed {count}` and a jest test on list invalidation after `trip_created`.
3. Decide per spec: fix (new issue), hand to the receipt-scan epic (memory `project_receipt_scan`), or close.

## How
Read-only PostHog queries; simulator repro.

## Acceptance criteria
- [ ] Both specs have SQL with a dated baseline and a status in plan §6.1.

## Verification
SQL files in `queries/fs/FS-PO15.sql`, `FS-PO16.sql`.

## Friction spec
FS-PO15: repro scan a blurred receipt → expected clear "Couldn't read" + prefilled manual form; check `receipt-scan-entry.yaml` (guard). FS-PO16: repro plan + save trip → expected listed ≤ 2 s; check jest if reproduced.

## Production metric
FS-PO15 fallback share and FS-PO16 empty-list rate by `{REL}`; baselines from this task. Tiles added to T03b if kept.

## Release
Research.

## Dependencies
- Blocked by: T02.
- Blocks: —

## Out of scope
Receipt-scan epic work.

## Constraints
Read-only.
