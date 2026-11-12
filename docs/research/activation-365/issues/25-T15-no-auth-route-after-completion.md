---
title: "[#365 T15] Guard: a session blip after onboarding completion never routes to (auth) nor resets onboarding"
labels: [bug, area:mobile, activation-365]
order: 25
task_id: T15
depends_on: [T04b]
phase: P1
size: S
release_path: "Release A 3.29.0"
---

## Context
#365, plan §3 T15 (guard part only, review item 14), specs FS-PO12, FS-PO13. Investigation/fix of the Google sheet after completion is T15b (conditional).

## Why
5 replays show sign-in screens or onboarding after completion (`01a16e01`, `01a17532`, `01a1b0c2`; `01a1ace6`, `01a1b1de`) [SOURCE: R6 F-PO12, F-PO13]. Any null-session event after a user existed runs `resetForSignOut()` (`app/_layout.tsx:698`, gated in `lib/auth-state-change.ts:86-117`). Cause confidence 30–35%; this guard is safe whatever the cause.

## What to change
A `TOKEN_REFRESHED` or transient null session after completion (followed by a session for the same user within N s, or while a refresh is pending) must not navigate to `(auth)` nor call `resetForSignOut()`; a real sign-out still does.

## How
`lib/auth-state-change.ts`, `app/_layout.tsx`. Jest `lib/__tests__/auth-state-change.test.ts`: blip after completion → no `(auth)` route, no reset; explicit sign-out → reset; different user → reset.

## Acceptance criteria
- [ ] Jest red on main for the blip case, green after; `pnpm verify:mobile`.
- [ ] `post-onboarding-no-signin.yaml` green on both platforms (guard only).

## Verification
`pnpm --filter @motovault/mobile test -- auth-state-change`.

## Friction spec
FS-PO12/FS-PO13. Repro: Android, Google-created account; Home → Profile, Diagnose → New, Discover. Expected: no sign-in or Google picker while the session is valid. Automated check: jest (CI) above (red first); maestro (local, both) `post-onboarding-no-signin.yaml` **guard only** (email sign-up; the repro needs a Google account): `runFlow onboarding.yaml` → `tapOn: {id: tab-profile}`, `{id: tab-diagnose}`, `{id: diagnose-new}`, `{id: tab-discover}` → `assertNotVisible: ".*Sign in.*|.*Continue with Google.*|.*Choose an account.*"`.

## Production metric
FS-PO12 (verbatim `R6…:449-455`) and FS-PO13 (`R6…:468-474`) by `{REL}`; plus `auth_session_lost` after completion. Baselines from T06 item 1 (3 + 2 replays; completed-twice lower bound 6/282 [SOURCE: R6-q3]). Target 0. Tiles "FS-PO12", "FS-PO13". Annotate Release A.

## Release
Release A; `FS-PO12: 2`, `FS-PO13: 2` (guard part).

## Dependencies
- Blocked by: T04b.
- Blocks: T18, T15b.

## Out of scope
Finding a stray `GoogleSignin.signIn` call (T15b).

## Constraints
Real sign-outs must still sign out (security); no PII.
