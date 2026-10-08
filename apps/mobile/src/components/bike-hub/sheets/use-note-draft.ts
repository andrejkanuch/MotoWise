import { useRef, useState } from 'react';
import type { SheetExit } from '../../../lib/bike-hub/constants';
import {
  type NoteDraft,
  newDraftToken,
  noteDraftKey,
  type ParkedDraft,
  restorableNoteDraft,
  useSheetDraftStore,
} from '../../../stores/sheet-draft.store';
import { DRAFT_OUTCOME, type DraftOutcome, publishDraftOutcome } from '../notes/use-draft-handoff';
import { useParkDraftOnExit } from './use-park-draft';

interface NoteDraftSource {
  bikeId: string;
  bikeIds: readonly string[];
  /** Set = edit mode: the slot is the note's, and there is no hand-off. */
  noteId?: string;
  /** The quick-add text the sheet was opened with. */
  draft?: string;
}

/**
 * The parked Note draft this sheet opens with, read once on mount (the sheet
 * opens either fresh or from what a dismissal left behind), and its slot key:
 * one per bike for a new note, one per note being edited.
 */
export function useRestoredNoteDraft({ bikeId, bikeIds, noteId, draft }: NoteDraftSource) {
  const key = noteDraftKey(bikeId, noteId);
  const [restored] = useState(() =>
    restorableNoteDraft({ key, bikeId, bikeIds, handoff: noteId ? undefined : draft }),
  );
  return { key, restored };
}

interface NoteDraftOptions {
  key: string;
  restored: ParkedDraft<NoteDraft> | null;
  isEdit: boolean;
  /** The quick-add text the sheet was opened with. */
  draft?: string;
  /** How the sheet was left (`SheetDiscardGuard.exit`). */
  exit: () => SheetExit;
  /** Typed and not saved, with no save in flight. */
  pending: () => boolean;
  /** Whether a save is in flight right now. */
  saving: () => boolean;
  /** The form's current work, minus the hand-off (this hook adds it). */
  snapshot: () => Omit<NoteDraft, 'handoff'>;
}

/**
 * The Note sheet's draft lifecycle: the quick-add hand-off it answers for, and
 * the parked-draft slot (`useParkDraftOnExit`).
 *
 * The hand-off is the text the sheet was opened with or — opened without one —
 * the one a restored draft grew from. A new note reports, once, whether a note
 * was created from it, so the field that handed it off clears (SAVED) or keeps
 * it and stops waiting (DISCARDED). Edits and draft-less sheets report nothing.
 *
 * Leaving undecided (Android drag-down) with unsaved work parks it and leaves
 * the hand-off pending, so a restored draft saved later still clears the field.
 * Leaving while a save is in flight parks nothing — the save settles it: SAVED
 * when the note lands, or, when it fails, the work is parked then (`saveFailed
 * AfterLeaving`). Work that could not be parked (another sheet holds the slot)
 * is reported DISCARDED: the field keeps its text.
 */
export function useNoteDraft(options: NoteDraftOptions) {
  const { key, restored, isEdit, draft } = options;
  const latest = useRef(options);
  latest.current = options;

  const handoff = useRef(isEdit ? undefined : draft || restored?.draft.handoff);
  const settled = useRef(!handoff.current);
  const settle = (outcome: DraftOutcome) => {
    if (settled.current) return;
    settled.current = true;
    publishDraftOutcome(handoff.current, outcome);
  };

  const slot = useParkDraftOnExit({
    restoredToken: restored?.token,
    exit: options.exit,
    pending: options.pending,
    park: (token) =>
      useSheetDraftStore
        .getState()
        .parkNote(key, { ...latest.current.snapshot(), handoff: handoff.current }, token),
    clear: (token) => useSheetDraftStore.getState().clearNote(key, token),
    onLeave: (parked) => {
      // A save in flight settles the hand-off when it ends; parked work keeps it pending.
      if (latest.current.saving() || parked) return;
      settle(DRAFT_OUTCOME.DISCARDED);
    },
  });

  return {
    settle,
    /** The note is on the server: empties the slot if this sheet holds it. */
    clearOwned: slot.clearOwned,
    /** The save failed after the sheet was dismissed mid-save: park it, or let the hand-off go. */
    saveFailedAfterLeaving: () => {
      if (!slot.parkUnlessTaken()) settle(DRAFT_OUTCOME.DISCARDED);
    },
    /**
     * "Clear" on the restored line: drops the parked draft. A hand-off known
     * only from it is dropped too — the field that handed it off keeps its text
     * and stops waiting.
     */
    dropRestored: () => {
      if (!draft) settle(DRAFT_OUTCOME.DISCARDED);
      handoff.current = isEdit ? undefined : draft;
      slot.clearOwned();
    },
  };
}

interface UnattachedPhotos {
  noteId: string;
  motorcycleId: string;
  /** The note's text and stamp as saved, so the edit sheet opens unchanged but for the photos. */
  text: string;
  stampOn: boolean;
  /** Local uris of photos that never attached. */
  photos: readonly string[];
  /** Ids of photos the rider removed that are still attached. */
  removals: readonly string[];
}

/**
 * The note was saved after its sheet was dismissed mid-save, but some photos
 * (or removals) did not go through and there is no sheet left to offer Retry.
 * They are parked as an edit draft of that note, so opening the note again
 * offers them back under the restored notice. Nothing is parked over a draft
 * already waiting in that note's slot.
 */
export function parkUnattachedPhotos(input: UnattachedPhotos): void {
  if (input.photos.length === 0 && input.removals.length === 0) return;
  useSheetDraftStore.getState().parkNote(
    noteDraftKey(input.motorcycleId, input.noteId),
    {
      text: input.text,
      stampOn: input.stampOn,
      alsoTask: false,
      targetId: input.motorcycleId,
      newPhotos: [...input.photos],
      removedPhotoIds: [...input.removals],
    },
    newDraftToken(),
  );
}
