---
title: Hidden bike-hub segment rows still receive taps through recycled native views
category: ui-bugs
date: 2026-10-08
tags: [react-native, fabric, gesture-handler, rngh, display-none, view-recycling, bike-hub, sheets, ios, touch-leak]
affected_modules: [mobile/bike-hub/shell/segment-interactive, mobile/bike-hub/shell/segment-container, mobile/bike-hub/expenses-section, mobile/shared/swipeable-expense]
---

## Problem

Tapping a key in the Odometer sheet (or an option in the Log sheet) did two things: the
sheet's own action, and a tap on an expense row that was not on screen. An Expense detail
screen was pushed **underneath** the sheet, a different expense per key. Cancel then popped
that screen instead of the sheet, so the sheet looked stuck.

The same bug was behind the 3.22.0 smoke-test anomaly "odometer sheet over expense detail".
That was written off as a navigation glitch; it was this.

The expense rows live in the Costs segment. The hub keeps every visited segment mounted and
hides the inactive ones with `display: 'none'`
(`apps/mobile/src/components/bike-hub/shell/segment-container.tsx`, the wrapper `style`). At
the time of the reports the user was on Overview, so Costs was hidden and none of its rows
could be seen, let alone touched.

## Root Cause

Two layers disagree about what "hidden" means.

1. **RN 0.86 (Fabric) removes `display: 'none'` subtrees from the native view tree** and
   returns their UIViews to the recycle pool. The React tree is untouched, so components,
   state and queries survive.
2. **react-native-gesture-handler 2.32 keeps each hidden row's gesture handler alive**,
   because the React component is still mounted. A handler only re-binds when its view tag
   has a mounted native view again; for a view that is gone the bind is a no-op. So the
   handler's `UIGestureRecognizer` stays attached to the old **UIView**, which has been
   recycled.

When a sheet then dequeues a recycled UIView (a keypad key, a quick-add chip, a Log option),
that view carries the hidden row's Tap / Pan / LongPress recogniser. A touch on the key
fires the key's own `onPress` **and** the old row's `openDetail()`.

`pointerEvents="none"` on the hiding wrapper does not help. It governs hit-testing of the
panel's own subtree, and the recogniser no longer lives in that subtree: it sits on a view
that belongs to some other screen.

## Diagnostic signature

Suspect this class of bug when all of these hold:

- A tap on screen A also triggers an action that belongs to screen B, which is hidden
  (`display: 'none'`) or otherwise not visibly mounted.
- It was seen on iOS (Fabric) and only **after** the hidden screen had been rendered at
  least once (view recycling needs a view to recycle).
- Which hidden item fires changes from tap to tap (here: a different expense per keypad key),
  because each key got a different recycled view.
- A JS-level guard such as `pointerEvents` or an `if (!visible)` check in `onPress` of the
  *visible* component changes nothing. The wrong handler is not in the component you tapped.
- Jest and the dev client do not show it. Jest has no native views at all, so it cannot reproduce
  this.

## Solution

`useSegmentInteractive()` in
`apps/mobile/src/components/bike-hub/shell/segment-interactive.ts` returns whether the
segment the component renders in can take touches right now: it is the active segment AND
the hub screen is focused (nothing pushed or presented over it). Outside a segment it is
always `true`. `SegmentContainer` provides the value through `SegmentInteractiveContext`
(`segment-container.tsx`, around the `{definition.render()}` call).

Every RNGH gesture inside a segment gates on it:

- `ExpensesSection` reads the hook and passes it down as `enabled={rowsInteractive}`
  (`apps/mobile/src/components/bike-hub/expenses-section.tsx`).
- `SwipeableExpense` calls `.enabled(enabled)` on the Pan, LongPress and Tap gestures
  (`apps/mobile/src/components/shared/swipeable-expense.tsx`, the three gesture builders). A
  disabled recogniser receives nothing, wherever its view ended up.
- Belt and braces: `openDetail` and `confirmDelete` in the same file also check
  `enabledRef.current` at call time, because a JS callback can land after the row was
  hidden but before the native `enabled` update reached the recogniser. The Tap only
  navigates on `success`.

Including "hub focused" in the value matters. Covering the hub with a sheet or a pushed
screen does not hide the segment, but it is exactly the moment recycled views are handed to
the new screen.

## Rule for future code

**Any new react-native-gesture-handler row or gesture inside a bike-hub segment MUST read
`useSegmentInteractive()` and pass it to `.enabled()` on every gesture it builds.** Do this
even for a gesture that "does nothing dangerous"; the leak is of the *recogniser*, and the
next component to dequeue that view pays for it. Plain `Pressable` / `onPress` are not
affected (they are not RNGH recognisers attached by tag), so they need nothing.

## Verification

- Unit: `apps/mobile/src/components/bike-hub/__tests__/segment-gesture-gating.test.tsx`
  asserts that the Tap neither recognises nor navigates when disabled, that rows work while
  Costs is active and the hub focused, do nothing once Costs is hidden, and do nothing while
  a sheet covers the hub and recover after. It pins the contract, but cannot reproduce the
  native leak.
- Device: iOS simulator **Release** build. Tap Odometer-sheet keys with Costs previously
  visited: touch leak (an Expense detail pushed under the sheet) **0 out of 4** after the
  fix.

## References

- Fix commit: `bdeca8eb` on `fix/bike-hub-ux` (squashed into `eb09574f` on main)
- `apps/mobile/src/components/bike-hub/shell/segment-interactive.ts` — the mechanism, in
  the file's own doc comment
- Related: `docs/solutions/ui-bugs/sheet-navigation-race-react-native-screens-4446.md` — the
  other bike-hub sheet bug found in the same device pass
