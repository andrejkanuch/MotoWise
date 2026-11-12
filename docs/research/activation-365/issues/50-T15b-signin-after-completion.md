---
title: "[#365 T15b] (Conditional) Investigate and fix sign-in screens / Google picker after onboarding completion"
labels: [bug, research, area:mobile, activation-365]
order: 50
task_id: T15b
depends_on: [T18, T06]
phase: P4
size: M
release_path: "next store build"
---

## Context
#365, plan §3 T15 (investigation part), specs FS-PO12, FS-PO13.

## Why
5 replays (`01a16e01`, `01a17532`, `01a1b0c2`; `01a1ace6`, `01a1b1de`) [SOURCE: R6 F-PO12, F-PO13]; cause confidence 30–35%.

## What to change
**Gate:** T06 item 1 baselines + 4 weeks of `auth_session_lost` and FS-PO12/13 on lvl ≥ 2, counted from 3.29.0 go-live per platform (D17; pre-fix comparison: R6 `$screen`-based SQL on earlier versions). If > 0: repro on Android with a Google account; find any `GoogleSignin.signIn`/`signInSilently` outside `(onboarding)`/`(auth)` (consumers of `hooks/use-oauth-sign-in.ts`: `account.tsx`, `sign-in.tsx`, `register.tsx`, `login.tsx`); fix. If nothing found and metrics are 0: close as "not reproduced", tiles stay.

## How
Device repro (Android emulator with GMS + a Google account — T00 AVD, or T00's optional API-34 Play-image AVD), logs, jest regression for whatever is found.

## Acceptance criteria
- [ ] Decision with numbers in `experiments.md`.
- [ ] If fixed: jest regression test red on main, green after.

## Verification
FS-PO12/FS-PO13 queries (verbatim `R6…:449-455`, `:468-474`) by `{REL}`.

## Friction spec
FS-PO12/13. Repro: Android, Google-created account; after Home open Profile, Diagnose → New, Discover; background 2 min; relaunch. Expected: no sign-in screen. Automated check: jest (CI) for the found cause; Maestro stays guard only (needs a Google account).

## Production metric
FS-PO12/FS-PO13 = 0 per version. Annotate when shipped.

## Release
Next store build (D17).

## Dependencies
- Blocked by: T18 (gate window starts at 3.29.0 go-live), T06.
- Blocks: —

## Out of scope
Credential Manager (T36).

## Constraints
Real sign-out must still work.
