import { useEffect, useRef, useState } from 'react';
import { SHEET_EXIT, type SheetExit } from '@/lib/bike-hub/constants';
import { newDraftToken } from '@/stores/sheet-draft.store';

interface ParkDraftOptions {
  /**
   * The token of the parked draft this sheet opened by restoring (the slot is
   * then its own), or `undefined` for a sheet that opened fresh.
   */
  restoredToken: string | undefined;
  /** How the sheet was left (`SheetDiscardGuard.exit`). */
  exit: () => SheetExit;
  /**
   * Work a dismissal now would lose: typed and unsaved. A save still in flight
   * is NOT pending work — a later sheet must never restore what may already be
   * on the server; the save parks it itself if it fails (`parkAfterFailedSave`).
   */
  pending: () => boolean;
  /** Writes the sheet's current work as the slot's newest draft, under `token`. */
  park: (token: string) => void;
  /** Empties the slot if `token` holds it. */
  clear: (token: string) => void;
  /** Runs once on unmount, after the exit was handled: whether the work was parked. */
  onLeave?: (parked: boolean) => void;
}

interface ExitContext {
  pending: () => boolean;
  park: () => void;
  clear: () => void;
}

/**
 * What leaving does to the parked draft, by how the sheet was left; returns
 * whether the work was parked. `park` and `clear` act only on this sheet's own
 * entry of the slot, so a draft it chose not to restore — or one another sheet
 * parked — is never lost to it.
 */
const ON_EXIT: Record<SheetExit, (context: ExitContext) => boolean> = {
  // A native dismissal nobody could ask about (Android drag-down): keep the work.
  [SHEET_EXIT.OPEN]: (context) => {
    if (context.pending()) {
      context.park();
      return true;
    }
    // Closed clean after restoring (the rider emptied it), or mid-save: nothing to keep.
    context.clear();
    return false;
  },
  [SHEET_EXIT.SAVED]: (context) => {
    context.clear();
    return false;
  },
  [SHEET_EXIT.DISCARDED]: (context) => {
    context.clear();
    return false;
  },
};

/**
 * Parks a sheet's unsaved work when it leaves the screen undecided, so an
 * Android drag-down (which react-native-screens 4.26 cannot hold back) keeps
 * what was typed for the next time the sheet opens. An explicit Discard or a
 * save clears it.
 *
 * Ownership is a token: the restored draft's, or a fresh one. A slot is a
 * newest-first stack (`DRAFT_STACK_MAX`) and each token touches only its own
 * entry, so a save that lands after its sheet is gone clears only its own
 * draft, and a sheet that did not restore a parked draft (a different quick-add
 * hand-off, or one reopened mid-save) parks beside it — nothing is refused.
 *
 * On iOS a dirty sheet cannot leave without Discard or Save, so this only ever
 * clears there (a parked draft cannot arise, but would be harmless).
 */
export function useParkDraftOnExit(options: ParkDraftOptions) {
  const latest = useRef(options);
  latest.current = options;
  const [token] = useState(() => options.restoredToken ?? newDraftToken());

  useEffect(
    () => () => {
      const { exit, pending, park, clear, onLeave } = latest.current;
      const parked = ON_EXIT[exit()]({
        pending,
        park: () => park(token),
        clear: () => clear(token),
      });
      onLeave?.(parked);
    },
    [token],
  );

  return {
    /** The token this sheet parks under (for a park done outside this hook). */
    token,
    /**
     * After a save lands (also once the sheet is gone) or the rider taps Clear:
     * empties the slot if this sheet holds it.
     */
    clearOwned: () => latest.current.clear(token),
    /**
     * A save failed after the sheet was dismissed mid-save: parks the work now,
     * as the slot's newest draft (beside any a later sheet parked meanwhile).
     */
    parkAfterFailedSave: () => latest.current.park(token),
  };
}
