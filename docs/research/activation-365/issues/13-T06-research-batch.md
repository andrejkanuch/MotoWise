---
title: "[#365 T06] Research batch: open questions that gate P1/P2 (no code)"
labels: [research, area:analytics, area:db, activation-365]
order: 13
task_id: T06
depends_on: []
phase: P0
size: S
release_path: "findings appended to docs/research/activation-365/experiments.md"
---

## Context
#365, plan §3 T06. Answers gate T07a (item 7), T14 (item 5), T15b (item 1), T23 (item 6), T29 (item 8).

## Why
Each item is an open question in a deep dive that changes how a later task is built [SOURCE: R1 OQ6, R2 OQ4–OQ5, R3 OQ1/OQ3, R4 §3.1/§3.3, R6 T2/T3].

## What to change
Answer each item with the query/read, result and date:
1. FS-PO12 / FS-PO13 baselines (`R6…:449-455`, `:468-474`).
2. Cause of the 3.26.0 diagnostics jump (29/117): 3.26.0 diff entry points (Home tools icon, onboarding symptom step, quick action `app/_layout.tsx:925-928`) + `$screen` path counts by version; name the entry with path:line.
3. Which commit each 3.26.0 store binary was built from (`asc builds list`; local builds are not in `eas build:list`).
4. Whether submit `FORBIDDEN` is ever the daily budget/circuit breaker (`apps/api/src/modules/ai-budget/ai-budget.service.ts:62-66, 320-373`).
5. Is `complete_onboarding` idempotent (`supabase/migrations/00191_complete_onboarding_make_only_bike.sql:84-117`, 00194 re-apply)?
6. Rider-edited OEM task signal: **partly answered** — `maintenance_tasks` has no edited column, only `updated_at` (`packages/types/src/database.types.ts:1994-2031`); check whether any trigger touches `updated_at` on system writes (then `updated_at > created_at + 1 min` is a usable proxy).
7. Does the reminder scheduler cap first notifications when ~10 dated tasks appear at once (R2 OQ5)?
8. Watch replays `01a19f85` 03:54:55–03:55:01 (PO8), `01a1815d` 07:19:20–40, `01a18bae` 07:24:50–07:25:06 (PO5).
9. Android push tokens after vc99: `push_token_registered` by platform (PostHog) and `select platform, count(*) from device_push_tokens where created_at > now() - interval '7 days' group by 1` (DB, read-only).
10. Re-run R6-q2 with F14 engaged return on the 100 scanned riders.

## How
Read-only PostHog `execute-sql`, Supabase Management API SELECT, code reads at `origin/main`, replay viewing (no new Replay Vision scans).

## Acceptance criteria
- [ ] Every item answered or "could not answer: <why>", with date and source.
- [ ] Items 5, 6, 7 state the consequence for T14b, T23, T07a explicitly.

## Verification
Reviewer spot-checks 2 queries by re-running them.

## Friction spec
None directly (research). Automated check: n/a.

## Production metric
FS-PO12/FS-PO13 baselines (item 1) and FS-PO2d entry split (item 2) become T03b tile baselines.

## Release
Docs only.

## Dependencies
- Blocked by: —
- Blocks: T07a, T14, T23, T29, T15b.

## Out of scope
New Replay Vision scans (credits; owner approval); any code.

## Constraints
SELECT only; no emails/names in findings.
