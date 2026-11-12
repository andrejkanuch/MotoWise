---
title: "[#365 T38] (Conditional) Keep the onboarding run across a same-user session drop"
labels: [bug, area:mobile, activation-365]
order: 53
task_id: T38
depends_on: [TR0, T18]
phase: P4
size: S
release_path: "next store build / OTA to 3.29.0+ runtime"
---

## Context
#365, plan §3 T38, spec FS-OB1f (OB1-H2).

## Why
Not confirmed (20%); not instrumented before T04b [SOURCE: R1 RC-F].

## What to change
**Gate:** `auth_session_lost {during_onboarding:true}` ≥ 2 riders/month for a month, counted from 3.29.0 go-live per platform. If met: keep the store when the next session is the same user id; login copy "Sign in to continue setting up". Files `lib/auth-state-change.ts`, `app/_layout.tsx`.

**Gate window (doc review 2026-11-12, item 3):** first-session onboarding events (`auth_oauth_*`, `onboarding_back`, `bike_setup_summary`, `auth_session_lost` during onboarding) exist only from **3.29.0**: TR0 is an OTA and reaches only later sessions of existing riders, while a new rider's first session runs the binary's embedded JS. So the gate window counts from 3.29.0 go-live **per platform**; the pre-fix comparison is the R1 proxy SQL (`deep-dives/R1-onboarding-reset.md`, null-session resets mid-onboarding) (`$screen`-based).

## How
Jest `lib/__tests__/auth-state-change.test.ts` (null then SIGNED_IN same id keeps `lastCompletedScreen`; different id wipes).

## Acceptance criteria
- [ ] Gate decision with numbers; if built, jest passes; 7 locales.

## Verification
`SELECT toStartOfMonth(timestamp) m, uniq(person_id) FROM events WHERE event='auth_session_lost' AND properties.during_onboarding = true AND timestamp >= '<3.29.0 go-live on that platform>' AND {EXCL} GROUP BY m`.

## Friction spec
FS-OB1f. Repro: Android emulator; sign up at account; admin sign-out of the user; background 65 min → foreground. Expected: same user resumes at the saved step. Automated check: jest (CI); Maestro not possible (server revocation).

## Production metric
FS-OB1f monthly riders by `{REL}`; baseline unknown; decision rule ≥ 2/month. Annotate if shipped.

## Release
Next build/OTA.

## Dependencies
- Blocked by: TR0, T18 (the gate window starts at 3.29.0 go-live).
- Blocks: —

## Out of scope
Session lifetime changes.

## Constraints
Different user must still wipe the run (privacy).
