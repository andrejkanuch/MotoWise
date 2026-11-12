---
title: "[#365 T38] (Conditional) Keep the onboarding run across a same-user session drop"
labels: [bug, area:mobile, activation-365]
order: 53
task_id: T38
depends_on: [TR0]
phase: P4
size: S
release_path: "next store build / OTA to 3.29.0+ runtime"
---

## Context
#365, plan §3 T38, spec FS-OB1f (OB1-H2).

## Why
Not confirmed (20%); not instrumented before T04b [SOURCE: R1 RC-F].

## What to change
**Gate:** `auth_session_lost {during_onboarding:true}` ≥ 2 riders/month for a month. If met: keep the store when the next session is the same user id; login copy "Sign in to continue setting up". Files `lib/auth-state-change.ts`, `app/_layout.tsx`.

## How
Jest `lib/__tests__/auth-state-change.test.ts` (null then SIGNED_IN same id keeps `lastCompletedScreen`; different id wipes).

## Acceptance criteria
- [ ] Gate decision with numbers; if built, jest passes; 7 locales.

## Verification
`SELECT toStartOfMonth(timestamp) m, uniq(person_id) FROM events WHERE event='auth_session_lost' AND properties.during_onboarding = true AND timestamp > now() - INTERVAL 60 DAY AND {EXCL} GROUP BY m`.

## Friction spec
FS-OB1f. Repro: Android emulator; sign up at account; admin sign-out of the user; background 65 min → foreground. Expected: same user resumes at the saved step. Automated check: jest (CI); Maestro not possible (server revocation).

## Production metric
FS-OB1f monthly riders by `{REL}`; baseline unknown; decision rule ≥ 2/month. Annotate if shipped.

## Release
Next build/OTA.

## Dependencies
- Blocked by: TR0.
- Blocks: —

## Out of scope
Session lifetime changes.

## Constraints
Different user must still wipe the run (privacy).
