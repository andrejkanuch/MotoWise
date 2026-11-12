---
title: "[#365 T17] Diagnosis failures: offline pre-check (expo-network), 75 s deadline, localized errors"
labels: [bug, area:mobile, activation-365]
order: 28
task_id: T17
depends_on: [T05b, T08]
phase: P1
size: M
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T17 (review item 10: no NetInfo), spec FS-PO2b, D6.

## Why
Successful diagnoses 6 s p50 / 11 s p90; failures p90 47 s, max 141 s, 7/14 offline, under a 300 s client timeout (`lib/graphql-client.ts:30-41, 55-63`); raw server text shown (`new.tsx:228`); 10 failures / 3 riders on 3.26.0 [SOURCE: R3 RC-4, Q8, Q9].

## What to change
Offline pre-check with `expo-network` (`Network.getNetworkStateAsync`, `apps/mobile/package.json:71`) and `isNetworkError` (`lib/network-error.ts:47`) → "You're offline. Your answers are kept…" + `diagnostic_failed {reason:'offline'}`; `GQL_TIMEOUT_MS.DIAGNOSIS = 75_000` on `SubmitDiagnosticDocument`; "Still working…" after 10 s; error classes → i18n keys (offline, throttled `TOO_MANY_REQUESTS`, timeout, server); **Add no native dependency.**

After the 75 s client deadline the server may still finish (and burn the free diagnosis), so:
- **Copy at the deadline:** "Still working — if it finishes, it will appear in your diagnoses". Never "Your free diagnosis wasn't used".
- **Submit stays disabled** until the server's maximum window has passed: `AI_CLIENT.TIMEOUT_MS` (60 000) × (1 + `AI_CLIENT.MAX_RETRIES` (3)) ≈ 240 s from send (`apps/api/src/config/constants.ts:41-45`; read the value into a client constant with a comment pointing there). Then refetch `diagnosticQuota`: unused → submit enabled; used → the diagnosis appears in the list (or T08's limit panel).
- **In-flight state:** spinner and disabled submit from send; "Still working…" at 10 s; Back keeps the answers (the form store is not cleared).
- **Quota refetch fails:** show Retry; Retry reruns the quota refetch first and re-enables submit only after it shows the diagnosis unused.

## How
Files `lib/graphql-client.ts`, `app/(tabs)/(diagnose)/new.tsx`, `components/diagnostic-flow/step-review-submit.tsx`, locales. Jest `app/(tabs)/(diagnose)/__tests__/new-timeout.test.tsx` (fake timers): "Still working…" at 10 s; timeout at 75 s → the "Still working — if it finishes…" copy, **no "wasn't used"/"not used" copy**, submit disabled; still disabled at 239 s; at 240 s quota refetch → enabled when unused; refetch error → Retry calls the refetch before any submit; Back keeps answers. Maestro `diagnose-offline.yaml` (Android, tag `android`).

## Acceptance criteria
- [ ] Jest (deadline copy, submit disabled until the 240 s window ends, quota-refetch Retry, still-working, mapping) passes; red run of `diagnose-offline.yaml` on main (request sent, raw error), green after.
- [ ] `apps/mobile/package.json` native deps unchanged; light/dark; `pnpm check:i18n`.

## Verification
`pnpm --filter @motovault/mobile test -- new-timeout`; Maestro log.

## Friction spec
FS-PO2b. Repro: (a) airplane mode → Analyze; (b) delay `submitDiagnostic` 120 s. Expected: (a) offline message, no request; (b) "Still working…" at 10 s; at 75 s "Still working — if it finishes, it will appear in your diagnoses" with submit disabled until ≈ 240 s, then a quota refetch; no raw server text. Automated check: maestro (local, Android emu) `diagnose-offline.yaml`: fill → airplane on → Analyze → `assertVisible: ".*offline.*"` → `assertNotVisible: ".*Failed to analyze.*|.*Network request failed.*"`; (b) jest only. iOS: jest only.

## Production metric
Verbatim `R3…:545-550` by `{REL}` + `diagnostic_failed.reason`. Baseline failure p90 47 s; 10/3 riders; 7/14 offline after send [SOURCE: R3 Q8, Q9]. Target p90 ≤ 75 s; ≤ 1.5 failures per failing rider; 0 post-send offline. Tile "FS-PO2b — diagnosis failures". Annotate Release A.

## Release
Release A (lvl 2); the release cut records the level of FS-PO2b in plan §6.1 (no code map).

## Dependencies
- Blocked by: T05b, T08.
- Blocks: T18.

## Out of scope
Server retry policy changes (D6 alternative).

## Constraints
AI not promoted; D6 copy; light/dark; 7 locales.
