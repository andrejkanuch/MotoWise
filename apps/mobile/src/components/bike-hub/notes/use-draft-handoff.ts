import { useEffect, useRef } from 'react';
import { isOptimisticNote } from './use-notes';

/** Whether a saved note exists that was not there when the draft was handed off. */
export function savedSinceHandoff(
  notes: readonly { id: string }[],
  idsAtHandoff: ReadonlySet<string>,
): boolean {
  return notes.some((note) => !isOptimisticNote(note) && !idsAtHandoff.has(note.id));
}

/**
 * A quick-add field hands its draft to the Note sheet (to add a photo, or to
 * write more) without clearing it: if the rider closes the sheet without
 * saving, the text is still in the field. Once the sheet has saved a note — a
 * new saved id shows up in the bike's notes — the field is cleared, so the same
 * text cannot be saved twice.
 *
 * Returns `handOff`, to call right before opening the sheet.
 */
export function useDraftHandoff(notes: readonly { id: string }[], clearDraft: () => void) {
  const idsAtHandoff = useRef<ReadonlySet<string> | null>(null);
  const clearRef = useRef(clearDraft);
  clearRef.current = clearDraft;

  useEffect(() => {
    const ids = idsAtHandoff.current;
    if (!ids || !savedSinceHandoff(notes, ids)) return;
    idsAtHandoff.current = null;
    clearRef.current();
  }, [notes]);

  return {
    handOff: () => {
      idsAtHandoff.current = new Set(notes.map((note) => note.id));
    },
    /** The field saved on its own: no sheet save is pending any more. */
    reset: () => {
      idsAtHandoff.current = null;
    },
  };
}
