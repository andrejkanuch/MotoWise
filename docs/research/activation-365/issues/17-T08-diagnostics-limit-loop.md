---
title: "[#365 T08] Diagnostics: stop the \"Try Again\" limit loop (typed limit state + in-form limit panel)"
labels: [bug, area:mobile, activation-365]
order: 17
task_id: T08
depends_on: [T05b]
phase: P1
size: S
release_path: "Release A 3.29.0 (optional older-runtime OTA per D14b)"
---

## Context
#365, plan §3 T08, spec FS-PO2a, owner decision D6 (copy).

## Why
After `FORBIDDEN`, `new.tsx` calls `requirePro('full_ai_diagnostics')` and sets `submitError` to raw English server text (`app/(tabs)/(diagnose)/new.tsx:220-228`); the review step shows an enabled "Try Again" (`components/diagnostic-flow/step-review-submit.tsx:145, 414-454`); each tap re-submits and re-presents the paywall. **3 of 5 limit riders on 3.26.0 looped 2–3× within seconds** (9 events) [SOURCE: R3 RC-1, Q2, Q3, Q9]. Confidence 90%.

## What to change
On `FORBIDDEN`: typed `limitReached` state (not `submitError`); in-form limit panel "This month's free diagnosis is used. It's back on {date}." (date from `useDiagnosticQuota().resetDate`, `components/diagnosis/use-diagnostic-quota.ts:46-82`) with "See Pro plans" (`presentPaywall`, `trigger:'rider_tap'`) and "Done"; no "Try Again"; automatic paywall at most once per form instance; never render server text. testIDs `diagnose-limit-panel`, `diagnose-limit-see-pro`, `diagnose-limit-done`. T21's `LimitSheet` later reuses these copy keys.

## How
Files: `app/(tabs)/(diagnose)/new.tsx`, `components/diagnostic-flow/step-review-submit.tsx`, `stores/diagnostic-flow.store.ts`, `src/i18n/locales/*.json` (7 app locales). Jest `app/(tabs)/(diagnose)/__tests__/new-limit.test.tsx` (mock `gqlFetcher` → `FORBIDDEN`). Runner opt-in `E2E_SEED_DIAGNOSIS_USED=1` inserting one `content_generation_log` success row for the test user — **local Supabase only** (`SUPABASE_URL` override), never production.

## Acceptance criteria
- [ ] Jest: `presentPaywall` called once; second submit no-op; no raw message rendered.
- [ ] Red run of `diagnose-limit-loop.yaml` on `origin/main` build, then green; logs + screenshots light/dark.
- [ ] `pnpm check:i18n`, `pnpm check:mobile-colors`, `pnpm verify:mobile` green.

## Verification
`pnpm --filter @motovault/mobile test -- new-limit`; `E2E_SEED_DIAGNOSIS_USED=1 pnpm --filter @motovault/mobile test:e2e:diagnose-limit-loop` (Android emulator, local Supabase).

## Friction spec
FS-PO2a. Repro: Android emulator preview build, free user with a used diagnosis; airplane mode on → Diagnose → Start → fill 4 steps → airplane off → Analyze → dismiss paywall → "Try Again" → paywall again. Expected: limit panel, no "Try Again", ≤ 1 automatic paywall. Automated check: maestro (local, Android emu; tag `android` for `setAirplaneMode`) `diagnose-limit-loop.yaml`: … → optional dismiss → `assertVisible: {id: diagnose-limit-panel}` → `assertNotVisible: "Try Again"` → `assertVisible: {id: diagnose-limit-see-pro}`; jest covers iOS. Red first.

## Production metric
Riders with ≥ 2 `diagnostic_limit_reached` in one `$session_id` (verbatim `deep-dives/R3-first-hour-paywalls.md:395-402`) by `{REL}`. Baseline 3.26.0 3 of 5 limit riders [SOURCE: R3 Q2]. Target 0 on lvl ≥ 2. Tile "FS-PO2a — diagnostics limit loop". Annotate Release A per T03a.

## Release
Release A; `ACTIVATION_FIXES.FS-PO2a = 2` at the cut.

## Dependencies
- Blocked by: T05b.
- Blocks: T17, T24, T18.

## Out of scope
The 1/month free limit (`MAX_AI_DIAGNOSTICS_PER_MONTH`, unchanged).

## Constraints
AI not promoted (panel is neutral); light/dark; 7 locales; D6 copy approval.
