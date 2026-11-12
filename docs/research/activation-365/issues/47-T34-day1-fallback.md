---
title: "[#365 T34] Exp 1 test arm: day-1 fallback local notification"
labels: [experiment, area:mobile, activation-365]
order: 47
task_id: T34
depends_on: [T30, T32, T33]
phase: P3
size: S
release_path: "Release B 3.30.0 (test arm only)"
---

## Context
#365, plan §3 T34, spec FS-EXP1 (d1 chain), D13. Board P04.1/P01.2.

## Why
Only riders who set a plan get T32's reminder; granted riders with no plan and no core action get nothing on day 1. Server push is out until Android FCM is live; local notifications are fine [SOURCE: board/06 F14].
**This is the only notification lever Exp 1 tests (validation V2 §5.1 item 5):** no other week-1 message exists today (1 of 426 new users got a server push in week 1). If T34 is cut for time, Exp 1 tests no notification at all; T33's delivery check and the push-token gap are prerequisites.
**`maintain_bike` riders (V2 §5.1 item 6):** they almost never come back on day 2 (3/72) but return on days 7–13 at the baseline rate (7/65). Their d1 copy ("When did you last service your {model}?", D13) stays the owner's bet, but read them on S1 and days 7–13, **never on S3**.

## What to change
Granted test-arm riders with no plan and no core action by end of day 0 → one `activation` notification next day 18:00 local, `source:'d1_fallback'`, goal-branched copy (`maintain_bike` copy = D13 owner bet); cancelled by any core action. Android without reminder copy if T33 failed.

## How
Jest scheduling rules (eligibility, cancel, one per rider per week 1, TZ).

## Acceptance criteria
- [ ] Jest passes; copy in all app locale files (`pnpm check:i18n`) without Pro/price/"free".

## Verification
`pnpm --filter @motovault/mobile test -- d1-fallback`.

## Friction spec
FS-EXP1 (d1). Repro: test arm, grant notifications, do nothing day 0. Expected: one notification day 1 18:00. Automated check: jest (CI) (time-based scheduling not Maestro-provable).

## Production metric
`reminder_scheduled/opened {source:'d1_fallback'}` by arm; S3 engaged return by arm (not raw, the notification's own opens excluded) [SOURCE: board/06 F14], except `maintain_bike` riders: S1 and days 7–13 only. Stop rule: revocations test ≥ control + 3 after 4 weeks → disable d1 only. Tile "FS-EXP1 — d1 fallback". Annotate launch.

## Release
Release B, test arm.

## Dependencies
- Blocked by: T30, T32, T33.
- Blocks: T35.

## Out of scope
Server push.

## Constraints
Apple 4.5.4; one activation notification per rider in week 1.
