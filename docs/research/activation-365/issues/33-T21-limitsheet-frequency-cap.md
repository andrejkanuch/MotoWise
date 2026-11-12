---
title: "[#365 T21] LimitSheet and a session frequency cap for feature-gate paywalls"
labels: [enhancement, area:mobile, activation-365]
order: 33
task_id: T21
depends_on: [T05a]
phase: P2
size: M
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T21, specs FS-PO3, S5, FS-PO2c (part), D5.

## Why
`requirePro`/`requireAccess` present on every call (`hooks/use-pro-gate.ts:64-105`); `presentPaywall` only joins in-flight requests (`lib/subscription.ts:770-792`). 3.26.0: **9/22 gate-paywall sessions ≥ 2 views, 8/22 same-feature ≤ 60 s**; first-hour ≥ 2 post-onboarding 8/121 [SOURCE: R3 RC-3, Q7, Q10; Q-P8]. 2 of 3 gate purchases came on a repeat view, so no hard cap [SOURCE: R3 Q12].

## What to change
`lib/paywall-frequency.ts` (in memory; resets on cold start or > 30 min background): 1 automatic present per feature per session, 2 per session, 10-min cooldown after `paywall_result: error`. Capped calls open `components/paywall/limit-sheet.tsx` (feature copy; reuses T08 diagnostics keys) with "See Pro plans" (`trigger:'rider_tap'`, never capped); fire `paywall_suppressed`, `limit_sheet_viewed`; `gate_policy:'capped_v1'`. testIDs `limit-sheet`, `limit-sheet-see-pro`, `limit-sheet-close`. Onboarding surfaces exempt via `isOnboardingPaywallSurface`.

## How
Consulted by `hooks/use-pro-gate.ts:64-105`, `app/(tabs)/(garage)/index.tsx:128-130`, `hooks/use-profile-data.ts:118-128`. Jest `lib/__tests__/paywall-frequency.test.ts` (5 rules incl. session reset). Maestro `gate-frequency-cap.yaml` (local Supabase seed for the used diagnosis).

## Acceptance criteria
- [ ] Red run of `gate-frequency-cap.yaml` on main (second paywall), green after; light then dark screenshots.
- [ ] `onboarding.yaml` and `onboarding-paywall-verify.yaml` pass unchanged (both arms).
- [ ] D5 recorded; 7 locales; `pnpm check:mobile-colors`.

## Verification
`pnpm --filter @motovault/mobile test -- paywall-frequency`; Maestro logs.

## Friction spec
FS-PO3. Repro: free user, seeded diagnosis: Diagnose → Start → dismiss → Start; Garage "Add a Bike" → dismiss → Home "+" → Profile "Add bike". Expected: ≤ 1 automatic present per feature, ≤ 2 per session; later taps open `LimitSheet`. Automated check: maestro (local, both) Garage Add → optional dismiss → Add again → `assertVisible: {id: limit-sheet}` → Diagnose Start → dismiss → Start → `assertVisible: {id: limit-sheet}` → `assertVisible: {id: limit-sheet-see-pro}`. Red first. RevenueCat absent: assert app UI only.

## Production metric
FS-PO3 (verbatim `R3…:473-485`) + `paywall_suppressed` by `{REL}`. Baseline 9/22 sessions [SOURCE: R3 Q10]; target 0. S5 3.26.0 8/121 → ≤ 2%. Guardrail: gate purchases + `rider_tap` views ≠ 0 over 8 weeks (baseline 3 gate purchases/60 d) [SOURCE: R3 Q11–Q12]. Tiles "FS-PO3", "S5". Annotate Release B.

## Release
Release B; `FS-PO3: 3`.

## Dependencies
- Blocked by: T05a.
- Blocks: T22, T24, T35.

## Out of scope
Onboarding paywall, RC experiment, `feature_gate` placement config.

## Constraints
A rider-tapped path to the paywall always exists; light/dark; D5.
