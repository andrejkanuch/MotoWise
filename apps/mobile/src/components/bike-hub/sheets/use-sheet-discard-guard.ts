import {
  type NavigationAction,
  useNavigation,
  usePreventRemove,
} from 'expo-router/react-navigation';
import { useEffect, useRef } from 'react';
import {
  SHEET_DISMISS_GUARD_PLATFORMS,
  SHEET_EXIT,
  type SheetExit,
} from '@/lib/bike-hub/constants';

/** The one navigation action a native sheet sends after it has ALREADY gone. */
const NATIVE_POP_ACTION = 'POP';

/**
 * Whether the sheet has already left the screen natively. Where the form sheet
 * can refuse a swipe-down (`SHEET_DISMISS_GUARD_PLATFORMS`, iOS) a `POP` is the
 * swipe it held back (`onNativeDismissCancelled`). Anywhere else (Android's
 * draggable bottom sheet ignores `preventNativeDismiss`) a `POP` arrives only
 * after the sheet is gone: holding it back would leave a route in JS with no
 * sheet on screen, so it is let through.
 */
export function sheetAlreadyDismissed(
  action: Pick<NavigationAction, 'type'>,
  os: string | undefined = process.env.EXPO_OS,
): boolean {
  return !SHEET_DISMISS_GUARD_PLATFORMS.has(os ?? '') && action.type === NATIVE_POP_ACTION;
}

interface SheetDiscardGuardOptions {
  /** Something typed that a dismissal would lose. */
  unsaved: boolean;
  /** A save is in flight: the sheet stays, and nothing asks "Discard?". */
  saving: boolean;
  /** Asks "Discard …?" and calls `discard` on the destructive choice. */
  confirmDiscard: (discard: () => void) => void;
}

export interface SheetDiscardGuard {
  /**
   * After a successful save: lets the next removal through and runs `back`
   * (the route's ONE `router.back()`). Does nothing once the sheet is gone — a
   * save that finishes after a dismissal must never pop the screen beneath.
   * Returns whether it navigated.
   */
  leaveAfterSave: (back: () => void) => boolean;
  /** False once the sheet has unmounted. */
  isMounted: () => boolean;
  /**
   * How the sheet was left: SAVED (`leaveAfterSave`), DISCARDED (the rider
   * chose Discard), or still OPEN — which, read on unmount, means a native
   * dismissal nobody could ask about (Android drag-down). Kept after unmount.
   */
  exit: () => SheetExit;
}

/**
 * The one unsaved-work guard of the hub's form sheets (Note, Odometer). Every
 * way out — Cancel (`router.back()`), the iOS swipe-down and the system Back —
 * reaches `usePreventRemove`, and each decision leaves with exactly ONE
 * navigation action: Discard re-dispatches the held action, never a second
 * `back()` (react-native-screens issue 4446).
 *
 * iOS: while the guard is on, native-stack sets `preventNativeDismiss`, UIKit
 * refuses the swipe (the sheet springs back) and the attempt lands here as a
 * `POP`. Android: Cancel and Back are held here; a drag-down has already
 * dismissed the sheet and is let through (`sheetAlreadyDismissed`) — the sheet
 * then parks its work (`useParkDraftOnExit`, `exit()` still OPEN) instead of
 * losing it.
 *
 * While a save is in flight the guard stays on and stays quiet: the removal is
 * swallowed (no prompt, no navigation) — the save closes the sheet itself. A
 * Discard tapped after the sheet saved or left is ignored, so a stale action
 * is never re-dispatched.
 */
export function useSheetDiscardGuard({
  unsaved,
  saving,
  confirmDiscard,
}: SheetDiscardGuardOptions): SheetDiscardGuard {
  const navigation = useNavigation();
  const mounted = useRef(true);
  const leaving = useRef(false);
  const exitRef = useRef<SheetExit>(SHEET_EXIT.OPEN);
  // Read when an event arrives, not when the callback was created.
  const savingRef = useRef(saving);
  savingRef.current = saving;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  usePreventRemove(saving || unsaved, ({ data }) => {
    const { action } = data;
    if (leaving.current || sheetAlreadyDismissed(action)) {
      navigation.dispatch(action);
      return;
    }
    if (savingRef.current) return;
    confirmDiscard(() => {
      // The sheet saved (and left) or is gone while the prompt was up.
      if (leaving.current || !mounted.current || savingRef.current) return;
      exitRef.current = SHEET_EXIT.DISCARDED;
      navigation.dispatch(action);
    });
  });

  return {
    leaveAfterSave: (back) => {
      if (!mounted.current) return false;
      leaving.current = true;
      exitRef.current = SHEET_EXIT.SAVED;
      back();
      return true;
    },
    isMounted: () => mounted.current,
    exit: () => exitRef.current,
  };
}
