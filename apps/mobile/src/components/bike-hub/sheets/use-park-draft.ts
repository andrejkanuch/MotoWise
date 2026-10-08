import { useEffect, useRef } from 'react';
import { SHEET_EXIT, type SheetExit } from '../../../lib/bike-hub/constants';

interface ParkDraftOptions {
  /** This sheet opened by restoring the parked draft: the slot is its own. */
  restored: boolean;
  /** How the sheet was left (`SheetDiscardGuard.exit`). */
  exit: () => SheetExit;
  /** Work a dismissal now would lose: typed and unsaved, or a save still in flight. */
  pending: () => boolean;
  /** Writes the sheet's current work to the draft store. */
  park: () => void;
  /** Removes this sheet's slot from the draft store. */
  clear: () => void;
}

interface ExitContext {
  pending: () => boolean;
  park: () => void;
  clear: () => void;
  owns: boolean;
  claim: () => void;
}

/** What leaving does to the parked draft, by how the sheet was left. */
const ON_EXIT: Record<SheetExit, (context: ExitContext) => void> = {
  // A native dismissal nobody could ask about (Android drag-down): keep the work.
  [SHEET_EXIT.OPEN]: (context) => {
    if (context.pending()) {
      context.park();
      context.claim();
      return;
    }
    // Closed clean after restoring — the rider emptied it: nothing left to keep.
    if (context.owns) context.clear();
  },
  [SHEET_EXIT.SAVED]: (context) => {
    if (context.owns) context.clear();
  },
  [SHEET_EXIT.DISCARDED]: (context) => {
    if (context.owns) context.clear();
  },
};

/**
 * Parks a sheet's unsaved work when it leaves the screen undecided, so an
 * Android drag-down (which react-native-screens 4.26 cannot hold back) keeps
 * what was typed for the next time the sheet opens. An explicit Discard or a
 * save clears it. A sheet only ever clears a slot it owns — one it restored,
 * or parked itself — so a draft it chose not to restore is never lost to it.
 *
 * On iOS a dirty sheet cannot leave without Discard or Save, so this only ever
 * clears there (a parked draft cannot arise, but would be harmless).
 */
export function useParkDraftOnExit(options: ParkDraftOptions) {
  const latest = useRef(options);
  latest.current = options;
  const owns = useRef(options.restored);

  useEffect(
    () => () => {
      const { exit, pending, park, clear } = latest.current;
      ON_EXIT[exit()]({
        pending,
        park,
        clear,
        owns: owns.current,
        claim: () => {
          owns.current = true;
        },
      });
    },
    [],
  );

  return {
    /**
     * After a save lands (also once the sheet is gone) or the rider taps Clear:
     * empties the slot if this sheet owns it.
     */
    clearOwned: () => {
      if (owns.current) latest.current.clear();
    },
  };
}
