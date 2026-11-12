---
title: "[#365 T14] Onboarding completion survives a cold start: persisted local completion flag"
labels: [bug, area:mobile, activation-365]
order: 24
task_id: T14
depends_on: [T04b, T06]
phase: P1
size: S
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T14 (cause-independent part only, review item 14), specs FS-OB1e, FS-PO13 (part), D1. The cached-`me` rule and server idempotency are T14b (conditional).

## Why
`onboardingCompleted` is not persisted (`stores/auth.store.ts:78-89, 140-152`); a 7-day persisted `me` is restored on cold start (`lib/query-persist.ts:67-74`); "Open my garage" wipes the onboarding store (`personalizing.tsx:389-393`). **10/291 completers saw onboarding again; 4 completed twice** [SOURCE: R1 RC-E, Q6, Q7]. Cause confidence 45%; a local flag is correct whatever the cause.

## What to change
Persist `onboardingCompletedForUserId` in the auth store (set wherever `setOnboardingCompleted(true)` is called; cleared on sign-out/user change); the gate treats `local flag for this user || me.onboardingCompleted` as completed.

## How
Files `stores/auth.store.ts`, `app/_layout.tsx` (gate `:417-419, 453-467`), `app/(onboarding)/personalizing.tsx`. Jest `app/__tests__/navigation-gate.test.tsx`: local flag + cached `false` → tabs; network `true` → tabs; error and no flag → onboarding; other user id → flag ignored.

## Acceptance criteria
- [ ] Jest passes; `pnpm verify:mobile`.
- [ ] `onboarding-complete-relaunch.yaml` green on Android emu (guard only — cannot force the stale-cache race).

## Verification
`pnpm --filter @motovault/mobile test -- navigation-gate`; Maestro log.

## Friction spec
FS-OB1e. Repro: finish onboarding; kill within 2 s of "Open my garage"; airplane mode → relaunch. Expected: Home (or offline banner), never Welcome. Automated check: jest (CI) `navigation-gate.test.tsx` (red first: the "local flag + cached false" case fails on main); maestro (local, Android emu, tag `android`) `onboarding-complete-relaunch.yaml` as guard: `runFlow onboarding.yaml` → `stopApp` → `setAirplaneMode: enabled` → `launchApp` → `assertVisible: {id: home-screen}` → `assertNotVisible: "Let's get started"`.

## Production metric
Plan §5 FS-OB1e SQL by `{REL}`; plus `gate_routed` by `onboarding_completed_source`. Baseline 10/291 relapsed, 4 completed twice [SOURCE: R1 Q7]. Target 0 on lvl ≥ 2. DB weekly cross-check `fs-ob1e-two-bikes.sql`. Tile "FS-OB1e — relapse into onboarding". Annotate Release A.

## Release
Release A; `FS-OB1e: 2`.

## Dependencies
- Blocked by: T04b, T06 (item 5).
- Blocks: T18, T14b.

## Out of scope
Cached-`me` rule, server no-op on second `complete_onboarding` (T14b).

## Constraints
D1; no paywall change.
