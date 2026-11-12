---
title: "[#365 T16a] \"Open my garage\" once: idempotent CTA, Retry only when the mutation failed"
labels: [bug, area:mobile, activation-365]
order: 26
task_id: T16a
depends_on: [T05d]
phase: P1
size: S
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T16 (split a), spec FS-OB6, **D1 (this edits the `garage_first` onboarding paywall CTA surface; review item 15)**.

## Why
Retry shows after a bare 8 s timer even when steps are ticked (`app/(onboarding)/personalizing.tsx:376-383`); `onboarding_completed` twice for 6/282; 7 completer replays (loops ×4, black 10 s, white 28 s, Retry with all ticked) [SOURCE: R6 F-OB6, R6-q3]. In `garage_first`, "Open my garage" presents the onboarding paywall (`personalizing.tsx:415`).

## What to change
CTA disabled after the first tap and `handleContinue` idempotent (`personalizing.tsx:389-393`); never render the payoff again once `completionSent && mutationDone`; Retry only when the mutation **failed** (keep "Skip and continue"). The paywall hand-off, placement, copy and order are untouched.

## How
Jest `app/(onboarding)/__tests__/personalizing.test.tsx`: double tap → one `handleContinue`, one paywall present; all ticked + slow network → no Retry; failed mutation → Retry. Maestro `post-onboarding-landing.yaml` (both paywall arms via `EXPECTED_ARM`, as `run-onboarding-paywall-e2e.sh`).

## Acceptance criteria
- [ ] Jest passes; **`onboarding-paywall-verify.yaml` passes in both arms** (runbook requirement).
- [ ] `post-onboarding-landing.yaml` green in both arms, both platforms; screenshots light + dark.
- [ ] Ledger date for the `onboarding_paywall_2026q4` readout cut.

## Verification
`pnpm --filter @motovault/mobile test:e2e:onboarding-paywall` (both arms) and the landing flow logs.

## Friction spec
FS-OB6. Repro: iOS sim + Android emu with a "3G/High latency" conditioner, finish onboarding in each arm, tap "Open my garage" twice. Expected: Home within 5 s; personalizing never again; no Retry with all ticked. Automated check: jest (CI) (red first: double-tap case); maestro (local, both) **guard only** (Maestro cannot set a link conditioner): `runFlow onboarding.yaml` → `extendedWaitUntil: {visible: {id: home-screen}, timeout: 10000}` → `assertNotVisible: ".*Personalizing.*|Open my garage|Retry"` → wait 5 s → assert again.

## Production metric
(a) completed twice (verbatim `R6…:340-345` with SCOREBOARD-CTE `R6…:250-261`); baseline 6/282 [SOURCE: R6-q3]; target 0. (b) p90 `post_onboarding_landed.ms_since_cta` < 3,000 ms. By `{REL}` and `onboarding_variant`. Tile "FS-OB6 — Open my garage". Annotate Release A.

## Release
Release A; `FS-OB6: 2`.

## Dependencies
- Blocked by: T05d.
- Blocks: T18.

## Out of scope
Home sheets (T16b); paywall content.

## Constraints
D1; onboarding paywall surfaces never capped, moved or re-styled; A/B and RC experiment keep running.
