---
title: "[#365 T32] Exp 1 test arm: \"When's your next ride?\" plan card + one local reminder"
labels: [experiment, area:mobile, activation-365]
order: 45
task_id: T32
depends_on: [T10, T30]
phase: P3
size: M
release_path: "Release B 3.30.0 (test arm only)"
---

## Context
#365, plan §3 T32, spec FS-EXP1 (plan chain), D13. Board P02.1/P03.1 [SOURCE: board/99-synthesis.md §4].

## Why
Goal, push grant and early logging separate day-2 returners; friction does not [SOURCE: R6 §3.1]. S1 week-1 core action baseline 61/367 (16.6%); 3.26.0 8/84 [SOURCE: evidence pack §2; Q-P5].

## What to change
`components/home/activation-plan-card.tsx`, an inline Home card above `OnboardingChecklist` (not a sheet), for test-arm riders with no real ride (replaces the FIRST_RIDE row). It shows only when no landing sheet is shown in that session (D11: consent, recall and "Service plan ready" sheets come first). Chips: **Later today, Tomorrow, This weekend, Not sure yet** (D13; no "Today" chip); fire times from `features/activation/plan-fire-time.ts` (+3 h capped 19:00; 10:00; Saturday 10:00; none); in-context permission once after a chip; one local notification via `lib/notifications.ts` kind `activation`, `source:'plan_card'`; opens Start Ride via the response handler (`app/_layout.tsx:975`); cancelled by any core action. Events `next_ride_plan_set {when, source, permission_granted}`, `reminder_scheduled/opened {kind:'activation', source}`, `activation_nudge_presented`.

Card states:
| State | What the rider sees | testID |
|---|---|---|
| unset | title + the four chips | `activation-plan-card`, `plan-chip-<when>` |
| chosen + permission granted | "Reminder set for <time>" + "Change" | `plan-card-scheduled`, `plan-card-change` |
| chosen + permission denied | "We'll keep this on your list" + "Open Settings"; no reminder promise | `plan-card-denied`, `plan-card-open-settings` |
| not sure yet | collapses to one line | `plan-card-collapsed` |
| core action done | card removed | — |

## How
Jest `features/activation/__tests__/plan-fire-time.test.ts` (chips, cap, TZ, DST, Saturday), `scheduler.test.ts` (max one activation notification; cancel on core action), `components/home/__tests__/activation-plan-card.test.tsx` (each state above; hidden while a landing sheet shows). Maestro `first-ride-plan-card.yaml` with `EXPECTED_ARM`.

## Acceptance criteria
- [ ] Jest passes; Maestro: test arm shows card, control absent; light/dark via `useEditorialTheme`; 7 locales; no Pro/price wording.
- [ ] Light and dark screenshots of every card state in the PR (unset, granted, denied, not sure).

## Verification
Maestro logs both arms (local, both).

## Friction spec
FS-EXP1 / FS-PO9. Repro: new account, test arm, Home after onboarding. Expected: card; chip → scheduled state survives relaunch. Automated check: maestro (local, both) `assertVisible: {id: activation-plan-card}` → `tapOn: {id: plan-chip-tomorrow}` → optional "Allow" → `assertVisible: {id: plan-card-scheduled}` → relaunch → still scheduled; control: `assertNotVisible: {id: activation-plan-card}`. Delivery: T33.

## Production metric
Plan-set rate among eligible test-arm completers (kill the card if < 1 in 10 after 8 weeks [SOURCE: board/99 §4]); S1 by `activation_arm` (Exp 1 primary); FS-PO9 (plan §5A.3, Q-P9: 3.26.0 11/121) by arm. Tiles "FS-EXP1 — plan card". Annotate the launch.

## Release
Release B, test arm.

## Dependencies
- Blocked by: T10, T30.
- Blocks: T33, T34, T35.

## Out of scope
Server push.

## Constraints
Apple 4.5.4 (no Pro/price/"free" in notifications); light/dark; one activation notification per rider in week 1.
