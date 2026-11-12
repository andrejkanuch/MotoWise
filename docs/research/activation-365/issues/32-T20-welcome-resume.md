---
title: "[#365 T20] Welcome resumes on any non-Back remount"
labels: [bug, area:mobile, activation-365]
order: 32
task_id: T20
depends_on: [T19a]
phase: P2
size: S
release_path: "Release B 3.30.0"
---

## Context
#365, plan §3 T20, spec FS-OB1d, D1. Review item 14 asked to gate it on data; kept in Release B because the fix is cause-independent (plan §8 #14).

## Why
Welcome resumes once per JS runtime (`resumeHandledThisLaunch`, `app/(onboarding)/index.tsx:23-29, 47-57`); 11 riders saw Welcome again in a live runtime with progress, 7 on 3.26.0; cause unknown (25%) [SOURCE: R1 RC-D, Q4, Q10].

## What to change
Replace the module flag with "resume unless `params.from === 'back'` or the store has no progress"; per-mount double-fire guard; `onboarding_welcome_mounted.reason` (T04b) names the trigger.

## How
Jest `app/(onboarding)/__tests__/welcome-resume.test.tsx` (flag already true + `lastCompletedScreen` + no `from:'back'` → `router.replace` resume).

## Acceptance criteria
- [ ] Jest red on main, green after; `pnpm verify:mobile`; ledger date (D1).

## Verification
`pnpm --filter @motovault/mobile test -- welcome-resume`.

## Friction spec
FS-OB1d. Repro: not reproduced (candidates: Back to Welcome, error-boundary retry, activity recreation). Expected: Welcome with progress resumes unless it came from Back. Automated check: jest (CI) only; no Maestro (trigger unknown).

## Production metric
`uniqIf(person_id, event='onboarding_welcome_mounted' AND properties.had_progress AND properties.reason != 'back')` by `{REL}`. Baseline 11 riders / 60 d, 7 on 3.26.0 (pre-event proxy) [SOURCE: R1 Q4, Q10]. Target 0 on lvl ≥ 3. Tile "FS-OB1d — Welcome remount". Annotate Release B.

## Release
Release B; `FS-OB1d: 3`.

## Dependencies
- Blocked by: T19a (`from:'back'` param).
- Blocks: T35.

## Out of scope
Finding the remount trigger (the event names it).

## Constraints
D1.
