---
title: "[#365 T13a] Persist the account/code draft (onboarding store v9 → v10) and restore the code step after relaunch"
labels: [bug, area:mobile, activation-365]
order: 22
task_id: T13a
depends_on: [T04b]
phase: P1
size: M
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T13 (split a), spec FS-OB3, D1, D10 (email on device until onboarding ends; never the password).

## Why
The account step keeps email/code in component state (`hooks/use-email-code-step.ts:4-13, 54`); resume targets the screen after the last *completed* one and the account step never records completion (`config/onboarding.ts:577-583`). Completion after resume: account 5/15 [SOURCE: R1 RC-C, Q13]; email code lost after relaunch in 1 of 19 senders [SOURCE: R5 Q13].

## What to change
Ruling D10 (plan §9, amended 2026-11-12): the email is not kept in MMKV.
- **SecureStore for the address.** `email` and `codeSentAt` live in one dedicated `expo-secure-store` key (installed, `apps/mobile/package.json:76`) behind a small helper, e.g. `lib/onboarding-email-draft.ts` with `saveEmailDraft({email, codeSentAt})`, `readEmailDraft()`, `clearEmailDraft()`. The helper is cleared in the onboarding store's `reset()` and `resetForSignOut()`, on code success, and at onboarding completion.
- **MMKV store v10** (`stores/onboarding.store.ts:203-233`, `version: 9` at `:212`) holds only `accountDraft {mode}` and the `bikeDraft` type (filled by T13b) so one migration covers both. No email, code or password in MMKV.
- On mount, read the SecureStore draft: within 1 h of `codeSentAt` reopen the code step for that address (verifyOtp needs no password); > 1 h → email form prefilled. Fire `email_code_step_restored {age_s}`.

## How
Files `stores/onboarding.store.ts`, new `lib/onboarding-email-draft.ts` (SecureStore helper), `app/(onboarding)/account.tsx`, `app/(onboarding)/sign-in.tsx`, `components/auth/email-code-step.tsx`, `hooks/use-email-code-step.ts`. Jest `stores/__tests__/onboarding.store.test.ts` (v9 → v10 keeps fields; `reset()`/`resetForSignOut()` clear the drafts and call `clearEmailDraft`; `partialize` output contains **neither email nor password**), a helper test (save/read/clear; cleared on code success and on completion), `__tests__/hooks/use-email-code-step.test.ts`. Runner `run-onboarding-email-code-e2e.sh` gets `RELAUNCH=1` → new middle flow `onboarding-email-code-relaunch.yaml`.

## Acceptance criteria
- [ ] Jest passes (migration; `partialize` has no `email` and no `password`; SecureStore helper cleared in all four places).
- [ ] Red run (relaunch loses the code step) on main, then green on iOS sim.
- [ ] Ledger date (D1); D10 approved.

## Verification
`RELAUNCH=1 sh apps/mobile/scripts/run-onboarding-email-code-e2e.sh` (local, iOS sim).

## Friction spec
FS-OB3. Repro: iOS sim, fresh install → account → "Continue with email" → a Resend test delivery address + password → code step → terminate → relaunch. Expected: "Enter your code" for the same address, no password field. Automated check: maestro (local, iOS sim) `stopApp` → `launchApp: {clearState: false}` → `extendedWaitUntil: {visible: "Enter your code", timeout: 30000}` → `assertVisible: "${TEST_EMAIL}"` → verify part. Red first.

## Production metric
`email_code_step_restored` / relaunches with a pending code step (`onboarding_resumed.pending_code_step=1`), and verified rate (verbatim `R5…:251-260`) by `{REL}`. Baseline 16/19 verified, 1 lost [SOURCE: R5 Q13]. Target restored = 100%; verified ≥ 90% (60 d). Tile "FS-OB3 — email code restored". Annotate Release A.

## Release
Release A (lvl 2); the release cut records the level of FS-OB3 in plan §6.1 (no code map).

## Dependencies
- Blocked by: T04b.
- Blocks: T13b, T18.

## Out of scope
Bike draft behaviour (T13b).

## Constraints
Never persist the password or the code; the email only in SecureStore, never MMKV; D1, D10; light/dark.
