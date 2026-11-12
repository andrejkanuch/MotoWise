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
#365, plan §3 T06. Answers gate T14 (item 5), T15b (item 1), T29 (item 8). Items 6 and 7 were settled by the doc review of 2026-11-12 (plan §10) and no longer gate T23 or T07a.

## Why
Each item is an open question in a deep dive that changes how a later task is built [SOURCE: R1 OQ6, R2 OQ4–OQ5, R3 OQ1/OQ3, R4 §3.1/§3.3, R6 T2/T3].

## What to change
Answer each item with the query/read, result and date:
1. ~~FS-PO12 / FS-PO13 baselines~~ **Measured by the validation:** FS-PO12 11/292 (3.26.0 5/120), FS-PO13 7/292 (3.26.0 5/120), per-completer SQL `validation/V1-metrics.md` §3.5 [SOURCE: V1-q40]. Item 1 is now: confirm 3–5 of these riders with replays (what screen, what triggered it).
2. Cause of the 3.26.0 diagnostics jump (29/117): 3.26.0 diff entry points (Home tools icon, onboarding symptom step, quick action `app/_layout.tsx:925-928`) + `$screen` path counts by version; name the entry with path:line.
3. Which commit each 3.26.0 store binary was built from (`asc builds list`; local builds are not in `eas build:list`).
4. Whether submit `FORBIDDEN` is ever the daily budget/circuit breaker (`apps/api/src/modules/ai-budget/ai-budget.service.ts:62-66, 320-373`).
5. Is `complete_onboarding` idempotent (`supabase/migrations/00191_complete_onboarding_make_only_bike.sql:84-117`, 00194 re-apply)?
6. Rider-edited OEM task signal: **answered by D8** — `maintenance_tasks` has no edited column, only `updated_at` (`packages/types/src/database.types.ts:1994-2031`); T23 uses the D8 proxy (pending, never completed, `updated_at` within 60 s of `created_at`). No longer gates T23; record only whether any trigger touches `updated_at` on system writes, as a note for T23's reviewer.
7. Does the reminder scheduler cap first notifications when ~10 dated tasks appear at once (R2 OQ5)? **Answered (doc review 2026-11-12):** no immediate burst, because imported tasks get due dates in the future; the risk is same-day clustering when several intervals fall due on the same anniversary. Today `sendDuePush` sends one push per task (`apps/api/src/modules/push-tokens/maintenance-push.service.ts:61, 125-158`), so the cap (one combined push per bike, at most one per bike per 7 days) is built inside T07a before its deploy. Record this answer in `experiments.md`.
8. Watch replays `01a19f85` 03:54:55–03:55:01 (PO8), `01a1815d` 07:19:20–40, `01a18bae` 07:24:50–07:25:06 (PO5). **And confirm the PO8 dialog type on a device:** T00 Android emulator, universal APK of the current store binary (`bundletool build-apks --mode=universal` + debug key), fresh install, Spanish locale, finish onboarding anonymously as far as possible without a production sign-up (or on the local-stack E2E build), open Discover, screenshot what appears within 2 s: the location permission dialog, a Play-services prompt, or something else. Baseline: 42 of 43 Android first Discover visits background within 2 s (median 0 s), iOS 0/28, Garage control 1/59 [SOURCE: V1-q36]. The answer decides T29's fix (T29 now targets Release A).
9. Android push tokens after vc99: `push_token_registered` by platform (PostHog) and `select platform, count(*) from device_push_tokens where created_at > now() - interval '7 days' group by 1` (DB, read-only). **Baseline is not 0:** android 3 tokens, all in the last 7 days, all test devices on FCM-capable builds; ios 106 total, 8 in 7 d [SOURCE: V3 §2]. vc99 is still an internal draft (T18 has the steps).
10. Re-run R6-q2 with F14 engaged return on the 100 scanned riders.

## How
Read-only PostHog `execute-sql`, Supabase Management API SELECT, code reads at `origin/main`, replay viewing (no new Replay Vision scans).

## Acceptance criteria
- [ ] Every item answered or "could not answer: <why>", with date and source.
- [ ] Item 5 states the consequence for T14/T14b explicitly; items 6 and 7 record the answers above.

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
- Blocks: T14, T29 (item 8 — confirm the dialog type before T29's fix), T15b.

## Out of scope
New Replay Vision scans (credits; owner approval); any code.

## Constraints
SELECT only; no emails/names in findings.
