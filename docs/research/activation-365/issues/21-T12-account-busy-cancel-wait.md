---
title: "[#365 T12] Account screen: busy state from tap, silent OAuth cancel, post-sign-in wait bounded at 8 s"
labels: [bug, area:mobile, activation-365]
order: 21
task_id: T12
depends_on: [T04a]
phase: P1
size: M
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T12, specs FS-OB2b, FS-OB2c, D1.

## Why
Cancel on the Google sheet shows "Error — Something went wrong" (`lib/oauth.ts:169-171`, `lib/oauth-error-alert.ts:19`); no busy state during OAuth (`app/(onboarding)/account.tsx:85, 152-207`); "Creating your account…" waits on `me` with retries and no upper bound (`account.tsx:110, 125-148`; `lib/query-client.ts:176-181`): **6/105 OAuth sign-ups > 10 s, max 141 s** [SOURCE: R5 C4–C7, Q8].

## What to change
`oauthBusy` from tap to settle (buttons disabled, spinner on the tapped button); expected cancel → no alert; advance after `ACCOUNT_ME_WAIT_MS = 8000` even if `me` is loading (the gate still routes onboarded accounts to tabs); fire `auth_post_signin_wait`.

## How
Files `app/(onboarding)/account.tsx`, `lib/oauth-error-alert.ts`, `hooks/use-oauth-sign-in.ts`. Jest `__tests__/screens/account-post-signin-wait.test.tsx` (fake timers). Maestro `onboarding-oauth-cancel.yaml` (Android emulator with a Google account, tag `android-oauth`).

## Acceptance criteria
- [ ] Jest: `me` never resolves → `goNext` once at 8 s, outcome `timeout`; resolves onboarded at 1 s → no `goNext`; cancel → no `presentOAuthError`.
- [ ] Red run of `onboarding-oauth-cancel.yaml` on main (alert shows), then green; light/dark screenshots of the busy state.
- [ ] No copy/order change on the account screen; ledger date (D1).

## Verification
`pnpm --filter @motovault/mobile test -- account-post-signin-wait`; Maestro run log (Android).

## Friction spec
FS-OB2c: Repro — account step → Google → Back on the picker. Expected — no alert, buttons enabled. Automated check: maestro (local, Android emu w/ Google account) `extendedWaitUntil: {visible: "(?i)choose an account|sign in with google", timeout: 20000}` → `back` → `extendedWaitUntil: {visible: "Continue with Google"}` → `assertNotVisible: "Something went wrong.*"`. Red first.
FS-OB2b: Repro — block the API host right after the sheet returns. Expected — overlay ≤ 8 s, flow advances. Automated check: jest (CI) only (the network cannot be cut at that moment in Maestro).

## Production metric
FS-OB2c: `auth_error_alert_shown {outcome:'cancelled'}` / `auth_oauth_result {outcome:'cancelled'}` by `{REL}`; baseline every cancel alerts [SOURCE: R5 C4]; target 0. FS-OB2b: `auth_post_signin_wait.wait_ms` p90 and count > 10 s; baseline 6/105 [SOURCE: R5 Q8]; target 0 > 10 s per 4 weeks. Tiles "FS-OB2b/OB2c". Annotate Release A.

## Release
Release A; `FS-OB2b: 2`, `FS-OB2c: 2`.

## Dependencies
- Blocked by: T04a.
- Blocks: T18.

## Out of scope
Credential Manager (T36).

## Constraints
D1; light/dark; no paywall change.
