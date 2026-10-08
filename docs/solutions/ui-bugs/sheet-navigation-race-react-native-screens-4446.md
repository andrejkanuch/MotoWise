---
title: All sheets go dead after router.back() then router.push() from a formSheet
category: ui-bugs
date: 2026-10-08
tags: [react-native-screens, expo-router, formsheet, modal, navigation, router-replace, ios, bike-hub, colour-guard]
affected_modules: [mobile/app/(tabs)/(garage)/log-entry, mobile/bike-hub/sheets]
---

## Problem

The Log sheet (the chooser behind the bike hub's "Log" pill) closed itself with
`router.back()` and then pushed the chosen form 600 ms later. Intermittently one of two
things happened:

- The form was presented on top of the not-yet-dismissed Log sheet, so Discard on the form
  revealed the Log sheet again.
- Worse: **every sheet in the app stopped working until relaunch.** Cancel / Save did
  nothing, and taps fell through to the screen below.

It was intermittent, so it looked like flakiness in the device pass rather than a bug.

## Root Cause

react-native-screens 4.26.2, upstream issue 4446. `router.back()` then `router.push()` sends
the native stack two separate modal updates, and the second lands while the first
dismissal is still animating. 4.26.2 does not handle that overlap: the dismissed sheet stays
presented natively while JS has already dropped it, and the native `_updatingModals` flag
(in `setModalViewControllers`) can stay set for good. From then on every later modal
open/close is ignored.

The 600 ms delay was a guess at "after the dismissal". There is no better signal to wait
for: the Log route unmounts as soon as it is popped from the navigation state, so its own
`transitionEnd` listener never fires.

## Diagnostic signature

- Sheets present fine on a fresh launch, then all of them (not one screen) fail after
  someone closes a formSheet and immediately opens another.
- JS state looks right (the route is gone from the navigation state) while the screen still
  shows the old sheet, or shows nothing new.
- Timing dependent: a slow `setTimeout` between back and push hides it on fast devices and
  does not fix it on slow ones. Do not tune the delay.
- Not reproducible in jest. Reproduce on a device or simulator Release build.

## Solution

**One navigation action per user decision from a sheet.** The Log sheet now calls a single
`router.replace(option.href(...))`
(`apps/mobile/src/app/(tabs)/(garage)/log-entry.tsx`, in `choose`). A replace is one update
that the native stack runs in order: dismiss this sheet, then present the form from the
dismissal's completion. There is never a window with two updates in flight.

Supporting details in the same file:

- A `chosen` ref makes a second tap before the replace lands a no-op, and makes Cancel after
  a choice a no-op (a `router.back()` there would be the second update again).
- The 600 ms timer and the `transitionEnd` listener were deleted, not adjusted.

## Rule for future code

From a formSheet, when the user's decision means "close this and open that", call
`router.replace` once. Never `router.back()` followed by `router.push()` (or `navigate`),
directly or through a timer, listener or promise. Closing with no follow-up is fine:
`router.back()` alone.

## Verification

Stuck-sheet loop on an iOS **Release** build: open Log, pick an option, discard, repeat. Ten
runs out of ten ended with every sheet still opening and closing normally.

## Gotcha: the colour guard reads the upstream issue number as hex

`scripts/check-no-hardcoded-mobile-colors.sh` fails on any **added** line in a changed
non-test file under `apps/mobile/src` that matches `#[0-9a-fA-F]{3,8}`. A hash followed by
`4446` is a valid 4-digit hex colour, so writing the issue the usual GitHub way in a code
comment fails the guard. This happened here; commit `7ba7c6ac` reworded four comments.

**Always write "issue 4446", never the hash form, in code comments** (any issue number of 3 to 8
hex-valid characters trips it). Test files and
`__tests__` are exempt, but keep one habit. This doc lives under `docs/`, which the guard
does not scan, but it follows the same rule so it can be pasted into a comment safely.

## References

- Fix commit: `35eefe9e` on `fix/bike-hub-ux` (squashed into `eb09574f` on main)
- Guard follow-up: `7ba7c6ac`
- Upstream: software-mansion/react-native-screens, issue 4446
- Related: `docs/solutions/ui-bugs/hidden-segment-rows-still-receive-taps-gesture-handler.md`
