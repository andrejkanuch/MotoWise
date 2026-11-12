---
title: "[#365 T11] Onboarding sign-in screen advances when the session lands; OAuth double-tap guard"
labels: [bug, area:mobile, activation-365]
order: 20
task_id: T11
depends_on: [T00, T04a, T04b]
phase: P1
size: S
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T11, spec FS-OB1a, D1 (both paywall arms; ledger date).

## Why
`app/(onboarding)/sign-in.tsx` has no reaction to a new session (only `goToGetStarted`, `:82`) while the gate keeps `(onboarding)` mounted for unfinished accounts (`app/_layout.tsx:459`). 15/72 auth riders repeated auth within 2 min, 9 never completed; **3.26.0: 6 of 10 sign-in riders stuck** [SOURCE: R1 RC-A, Q11, Q12; plan Q-P7]. Confidence 85%.

## What to change
Mirror `app/(onboarding)/account.tsx:125-148`: session + `me` settled → onboarded: let the gate route to tabs; else `router.replace(getResumeRoute(...) ?? OB_ROUTE.EXPERIENCE)` with route param `notice=account_ready`.
- **"Account ready" notice:** the destination screen reads `notice=account_ready` and shows a transient notice "Account ready — let's set up your garage" (testID `onboarding-account-ready`); it auto-dismisses after 4 s, is announced to screen readers (`AccessibilityInfo.announceForAccessibility` / `accessibilityLiveRegion="polite"`), and does not show again on a re-render or Back (clear the param after showing). No notice without the param. Module-level in-flight guard in `hooks/use-oauth-sign-in.ts`. testID `onboarding-sign-in-screen`.

## How
Jest `app/(onboarding)/__tests__/sign-in-session-advance.test.tsx`, `__tests__/hooks/use-oauth-sign-in.test.ts` (double tap). New runner `scripts/run-onboarding-signin-e2e.sh` (confirmed, not-onboarded user via admin API, `is_synthetic`), flow `onboarding-signin-unfinished-account.yaml`, script `test:e2e:onboarding-signin`.

## Acceptance criteria
- [ ] Red run on `origin/main` (stays on sign-in), then green on iOS sim + Android emu.
- [ ] Jest passes, incl. the notice: shown with `notice=account_ready`, gone after 4 s (fake timers), screen-reader announcement called once, absent without the param; notice light/dark screenshots; all app locale files (`pnpm check:i18n`); `pnpm verify:mobile`.
- [ ] Ledger: both-arm change date (D1).

## Verification
`pnpm --filter @motovault/mobile test:e2e:onboarding-signin`.

## Friction spec
FS-OB1a. Repro: T00 E2E build pointed at the local stack (the runner creates users; never production), `clearState`+`clearKeychain`, confirmed account with `onboardingCompleted=false`; Welcome → "Already have an account? Sign in" → email + password. Expected: within 5 s leaves sign-in (resume target / experience + banner); onboarded user → Home. Automated check: maestro (local, both) — `launchApp` → wait "Let's get started" → tap "Already have an account? Sign in" → consent `runFlow when` → "Continue with email" → `inputText` (tap a label to dismiss the custom keyboard) → submit → `extendedWaitUntil: {visible: ".*How long have you.*", timeout: 8000}` → `assertVisible: {id: onboarding-account-ready}` → `assertNotVisible: {id: onboarding-sign-in-screen}`. Red first.

## Production metric
Plan §5 FS-OB1a SQL (run, Q-P7) + `lvl`. Baseline 3.26.0 6/10 stuck; secondary ≥ 2 auths within 2 min 15/72 [SOURCE: Q-P7; R1 Q11]. Target 0 stuck (allow 1) after ≥ 5 sign-in auths on lvl ≥ 2; secondary ≤ 2. Tile "FS-OB1a — stuck after sign-in". Annotate Release A.

## Release
Release A (lvl 2); the release cut records the level of FS-OB1a in plan §6.1 (no code map).

## Dependencies
- Blocked by: T00 (test environment), T04a, T04b.
- Blocks: T18.

## Out of scope
OAuth SDK change (T36).

## Constraints
D1; no paywall change; light/dark; all app locale files (`pnpm check:i18n`); testID `onboarding-account-ready` (plan §3A.4, T11 row).
