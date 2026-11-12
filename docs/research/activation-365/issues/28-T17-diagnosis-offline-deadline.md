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
Offline pre-check with `expo-network` (`Network.getNetworkStateAsync`, `apps/mobile/package.json:71`) and `isNetworkError` (`lib/network-error.ts:47`) → "You're offline. Your answers are kept…" + `diagnostic_failed {reason:'offline'}`; `GQL_TIMEOUT_MS.DIAGNOSIS = 75_000` on `SubmitDiagnosticDocument`; "Still working…" after 10 s; error classes → i18n keys (offline, throttled `TOO_MANY_REQUESTS`, timeout, server); after a timeout re-submit disabled until a `diagnosticQuota` refetch shows the diagnosis unused. **Add no native dependency.**

## How
Files `lib/graphql-client.ts`, `app/(tabs)/(diagnose)/new.tsx`, `components/diagnostic-flow/step-review-submit.tsx`, locales. Jest `app/(tabs)/(diagnose)/__tests__/new-timeout.test.tsx` (fake timers). Maestro `diagnose-offline.yaml` (Android, tag `android`).

## Acceptance criteria
- [ ] Jest (deadline, still-working, mapping) passes; red run of `diagnose-offline.yaml` on main (request sent, raw error), green after.
- [ ] `apps/mobile/package.json` native deps unchanged; light/dark; `pnpm check:i18n`.

## Verification
`pnpm --filter @motovault/mobile test -- new-timeout`; Maestro log.

## Friction spec
FS-PO2b. Repro: (a) airplane mode → Analyze; (b) delay `submitDiagnostic` 120 s. Expected: (a) offline message, no request; (b) "Still working…" at 10 s, stop at 75 s with "Your free diagnosis wasn't used"; no raw server text. Automated check: maestro (local, Android emu) `diagnose-offline.yaml`: fill → airplane on → Analyze → `assertVisible: ".*offline.*"` → `assertNotVisible: ".*Failed to analyze.*|.*Network request failed.*"`; (b) jest only. iOS: jest only.

## Production metric
Verbatim `R3…:545-550` by `{REL}` + `diagnostic_failed.reason`. Baseline failure p90 47 s; 10/3 riders; 7/14 offline after send [SOURCE: R3 Q8, Q9]. Target p90 ≤ 75 s; ≤ 1.5 failures per failing rider; 0 post-send offline. Tile "FS-PO2b — diagnosis failures". Annotate Release A.

## Release
Release A; `FS-PO2b: 2`.

## Dependencies
- Blocked by: T05b, T08.
- Blocks: T18.

## Out of scope
Server retry policy changes (D6 alternative).

## Constraints
AI not promoted; D6 copy; light/dark; 7 locales.
