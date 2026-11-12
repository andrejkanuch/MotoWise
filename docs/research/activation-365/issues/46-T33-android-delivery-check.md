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

## What to change
Nothing in code. Schedule next-day 18:00 on a stock Pixel (Android 14+) and a Samsung on default battery settings with a T32 build; record delivery time and `activation_nudge_presented`.

## How
Two devices, two nights; screenshots of the notification shade with timestamps.

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
