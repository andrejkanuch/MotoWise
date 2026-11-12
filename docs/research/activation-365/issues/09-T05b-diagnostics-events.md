---
title: "[#365 T05b] Diagnostics events: diagnostic_started once per entry with entry source; diagnostic_failed reason + elapsed"
labels: [instrumentation, area:mobile, area:analytics, activation-365]
order: 9
task_id: T05b
depends_on: [T01]
phase: P0
size: S
release_path: "TR0 per-runtime OTA + Release A"
---

## Context
#365, plan §3 T05 (split b), specs FS-PO2a/b/c/d. Needed for T08, T17 and T06 item 2.

## Why
`diagnostic_started` re-fires on every focus: 51 started vs 47 submitted [SOURCE: R3 C13, Q9]. 3.26.0 hour-1 diagnosis jumped to 29/117 (25%) vs 3–9% before, entry point unknown [SOURCE: R6-q3]. Failures have no reason [SOURCE: R3 Q8].

## What to change
- Move `diagnostic_started` out of `useFocusEffect` (`app/(tabs)/(diagnose)/new.tsx:70-79`) into `components/diagnosis/use-start-diagnosis.ts:6-13` and `use-diagnostic-entry-gate.ts:22-46` with `entry: 'list'|'detail'|'quick_action'|'home_tool'`.
- `diagnostic_failed` gains `reason: 'offline'|'timeout'|'throttled'|'server'|'limit'`, `elapsed_s`.

## How
Jest `apps/mobile/src/components/diagnosis/__tests__/use-start-diagnosis.test.tsx`: refocusing the form does not fire again; each entry sets its `entry`.

## Acceptance criteria
- [ ] One `diagnostic_started` per entry (test); `entry` always set.
- [ ] `diagnostic_failed.reason` from a typed mapping (no raw server text).
- [ ] `pnpm verify:mobile` green.

## Verification
On TR0's update id: `countIf(event='diagnostic_started')/countIf(event='diagnostic_submitted')` ≈ 1.0–1.3 (form abandons allowed).

## Friction spec
FS-PO2d (research input) + FS-PO2a/b measurement. Repro: Diagnose → Start → switch tab → back to the form. Expected: one `diagnostic_started`. Automated check: jest (CI).

## Production metric
First-hour `diagnostic_started` among completers by `entry` and `{REL}`. Baseline 3.26.0 29/117 [SOURCE: R6-q3]. No target (handle, don't promote AI). Tile "FS-PO2d — first-hour diagnostics by entry". Annotate per T03a.

## Release
JS only → TR0 + Release A.

## Dependencies
- Blocked by: T01.
- Blocks: T08, T17, TR0.

## Out of scope
Changing entry points or the 1/month free limit.

## Constraints
AI diagnostics is not promoted; events only.
