---
title: "[#365 T33] Android next-day local notification delivery check (Pixel + Samsung)"
labels: [research, area:mobile, activation-365]
order: 46
task_id: T33
depends_on: [T32]
phase: P3
size: S
release_path: "device check; result in experiments.md"
---

## Context
#365, plan §3 T33; gates T34 and reminder copy [SOURCE: board/99 §4].

## Why
Android battery policies can delay inexact next-day alarms; the plan card and d1 fallback promise a time.
**More than a gate (validation V2 §5.1 item 5):** T32's reminder and T34's d1 fallback are the plan's **only test of a re-engagement message**. In week 1 today, 1 of 426 new users got a server push, 6 persons ever had a local reminder scheduled, and only 55 of 426 new users have a push token; the push-grant correlation with return (OR 1.7, not significant after adjustment) is a rider trait, not a message effect. A failed delivery check silently removes the notification arm of the experiment.

## What to change
Nothing in code. Schedule next-day 18:00 on a stock Pixel (Android 14+) and a Samsung on default battery settings with a T32 build; record delivery time and `activation_nudge_presented`.

## How
Two devices, two nights; screenshots of the notification shade with timestamps. Also record whether each device registered a push token (`push_token_registered`, `platform`): the push-token gap (`push-tokens-investigation.md`; FCM via vc99 or 3.29.0, T18) is a prerequisite for any later server-side message.

## Acceptance criteria
- [ ] Result table (device, scheduled, delivered, delta) in `experiments.md`.
- [ ] Decision: pass (≤ 1 h late on both) → T34 as specified; fail → Android gets card + sheet without reminder copy.

## Verification
Owner reviews the table.

## Friction spec
FS-EXP1 (delivery). Repro: schedule via chip "Tomorrow". Expected: delivered within 1 h of 18:00. Automated check: none possible (OS delivery is not Maestro-provable) — manual device check, why: OS scheduler behaviour.

## Production metric
`activation_nudge_presented` / `reminder_scheduled {kind:'activation'}` by platform after launch; target ≥ 90% presented on Android. Tile in T03b.

## Release
None.

## Dependencies
- Blocked by: T32.
- Blocks: T34.

## Out of scope
Exact alarms permission.

## Constraints
Test devices only; no production accounts besides test ones.
