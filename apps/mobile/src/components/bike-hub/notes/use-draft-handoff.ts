import { useEffect, useRef } from 'react';
import { normaliseNoteText } from '../../../lib/bike-hub/notes';

/** How a Note sheet opened with a handed-off draft ended. */
export const DRAFT_OUTCOME = {
  /** A note was created from the sheet — on this bike or, via "Attach to", another. */
  SAVED: 'saved',
  /** The sheet closed without creating a note. */
  DISCARDED: 'discarded',
} as const;
export type DraftOutcome = (typeof DRAFT_OUTCOME)[keyof typeof DRAFT_OUTCOME];

type DraftOutcomeListener = (draft: string, outcome: DraftOutcome) => void;

const listeners = new Set<DraftOutcomeListener>();

/**
 * Called by the Note sheet, once, for the draft it was opened with: SAVED as
 * soon as the note exists on the server (even if the sheet was dismissed while
 * it saved), DISCARDED when it closes without one. Matched on the normalised
 * draft text, so only the field that handed that text off reacts.
 */
export function publishDraftOutcome(draft: string | undefined, outcome: DraftOutcome): void {
  const text = normaliseNoteText(draft ?? '');
  if (!text) return;
  for (const listener of [...listeners]) listener(text, outcome);
}

/** Subscribes to sheet outcomes; returns the unsubscribe. */
export function subscribeDraftOutcome(listener: DraftOutcomeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** What the field does with an outcome for the draft it handed off. */
const ON_OUTCOME: Record<DraftOutcome, { clear: boolean }> = {
  [DRAFT_OUTCOME.SAVED]: { clear: true },
  [DRAFT_OUTCOME.DISCARDED]: { clear: false },
};

/**
 * A quick-add field hands its draft to the Note sheet (to add a photo, or to
 * write more) without clearing it: closing the sheet without saving leaves the
 * text in the field. The field is cleared only when THAT sheet reports it saved
 * a note — whatever bike it went to, and even if the rider edited the text
 * there — so the same words cannot be saved twice.
 *
 * Nothing else clears it: an unrelated note (another sheet, the Log sheet, an
 * optimistic quick-add landing) never matches the handed-off text. The hand-off
 * is disarmed when the sheet closes without saving and when the rider edits
 * the field again (`disarm`).
 *
 * The host does NOT disarm when it regains focus: a sheet dismissed mid-save
 * (an Android drag-down cannot be held back) reports SAVED after the host is
 * back on screen, and that report must still clear the field.
 */
export function useDraftHandoff(clearDraft: () => void) {
  const armed = useRef<string | null>(null);
  const clearRef = useRef(clearDraft);
  clearRef.current = clearDraft;

  useEffect(
    () =>
      subscribeDraftOutcome((draft, outcome) => {
        if (armed.current === null || armed.current !== draft) return;
        armed.current = null;
        if (ON_OUTCOME[outcome].clear) clearRef.current();
      }),
    [],
  );

  return {
    /** Right before the sheet opens with `draft`. */
    handOff: (draft: string) => {
      armed.current = normaliseNoteText(draft);
    },
    /** The field changed or saved on its own: no sheet result applies to it any more. */
    disarm: () => {
      armed.current = null;
    },
  };
}
