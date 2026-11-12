---
title: "[#365 T20] Welcome resumes on any non-Back remount (ships in the same build as T19a)"
labels: [bug, area:mobile, activation-365]
order: 32
task_id: T20
depends_on: [T00, T19a]
phase: P2
size: S
release_path: "Release B 3.30.0, in the same build as T19a (if either misses the freeze, both wait for the next store build)"
---

## Context
#365, plan §3 T20, §3A.0 rule 8, spec FS-OB1d, D1. Review item 14 asked to gate it on data; kept because the fix is cause-independent (plan §8 #14). The device repro of 2026-11-12 found the trigger (`validation/V4-device-repro.md` (b), plan §11).

## Why
- Welcome resumes once per JS runtime (`resumeHandledThisLaunch`, `app/(onboarding)/index.tsx:23-29`, read at `:49`). Riders who saw Welcome again in a live runtime with progress (pre-event proxy): **12 in 60 d, 6 on 3.26.0** [SOURCE: V1-q37; R1 Q4, Q10 had 11 / 7].
- **Trigger reproduced on the store binary 3.28.0 (V4 b3, cause 25% → ~80%):** Android Back out of the onboarding root (from Welcome, or from a resumed root step), then launch from the launcher while the process is still cached → `LaunchState: WARM`: the activity is recreated in the same JS runtime, `resumeHandledThisLaunch` is already `true`, and Welcome shows with **no resume** although the store holds bike + goals + `lastCompletedScreen`. Tapping "Let's get started" walks forward with the data kept; only the position is lost. Seen twice. Other triggers (OS activity recreation) may exist; this one is enough.
- **Coupling with T19a:** T19a's "only Welcome returns `false` so the OS backgrounds the app" produces exactly this warm relaunch. The warm Welcome mount carries no `from:'back'` param (the new activity mounts Welcome fresh), so without T20 every rider who backs out of Welcome hits RC-D on the next launch. **T19a and T20 ship in the same build.**

## What to change
Replace the module flag with "resume unless `params.from === 'back'` or the store has no progress"; a fresh Welcome mount in a new activity (no param) **is** a mount to resume; keep a per-mount double-fire guard; `onboarding_welcome_mounted.reason` (T04b) names the cause (`'remount'` for a fresh activity). Alternative considered (V4): call `moveTaskToBack` on Welcome instead of returning `false` (keeps the activity) — T19a owns that choice; T20 is needed either way for other remount paths.

## How
Jest `app/(onboarding)/__tests__/welcome-resume.test.tsx`: flag already true + `lastCompletedScreen` + no `from:'back'` → `router.replace` resume; **"flag true, new mount, no param → resume"**; `from:'back'` → no resume; empty store → no resume.
Maestro `onboarding-welcome-warm-resume.yaml` (tag `android`): shared steps to bike-setup → `pressKey: back` until the app is backgrounded (Welcome, then out) → `launchApp` (no `stopApp`, no `clearState`) → `assertNotVisible: "Let's get started"` → `assertVisible` the resume screen. Script `test:e2e:onboarding-welcome-warm-resume` + README line.

## Acceptance criteria
- [ ] Jest and Maestro red on main, green after; `pnpm verify:mobile`; ledger date (D1).
- [ ] Merged for the same store build as T19a (release PR lists both).

## Verification
`pnpm --filter @motovault/mobile test -- welcome-resume`; `pnpm --filter @motovault/mobile test:e2e:onboarding-welcome-warm-resume` (local, Android emu, T00 Android E2E build).

## Friction spec
FS-OB1d. Repro: Android emulator; to bike-setup → Back until the app leaves → launch from the launcher (warm). Expected: the resume screen, not Welcome; Welcome with progress resumes unless it came from Back. Automated check: jest (CI) + maestro (local, Android) `onboarding-welcome-warm-resume.yaml`. Red first.

## Production metric
`uniqIf(person_id, event='onboarding_welcome_mounted' AND properties.had_progress AND properties.reason != 'back')` by `{REL}`. Baseline (pre-event proxy) 12 riders / 60 d, 6 on 3.26.0 [SOURCE: V1-q37]. Target 0 on lvl ≥ 3. Tile "FS-OB1d — Welcome remount". Annotate Release B.

## Release
Release B, same build as T19a; `FS-OB1d: 3`.

## Dependencies
- Blocked by: T00 (test environment), T19a (`from:'back'` param).
- Blocks: T35 (soft, with T19a).

## Out of scope
Other remount triggers (the event names them if they exist).

## Constraints
D1; T19a and T20 never ship in different builds.
