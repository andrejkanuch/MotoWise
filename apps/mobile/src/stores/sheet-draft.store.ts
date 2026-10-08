import { File } from 'expo-file-system';
import { create } from 'zustand';
import { SHEET_DRAFT_KEY } from '../lib/bike-hub/constants';
import { normaliseNoteText } from '../lib/bike-hub/notes';

/**
 * Work a hub form sheet was holding when it left the screen without a decision.
 *
 * Android's draggable form sheet ignores `preventNativeDismiss` (react-native-
 * screens 4.26), so a drag-down cannot be held back and asked about the way the
 * iOS swipe is. Instead of losing what was typed, the sheet parks it here and
 * offers it back the next time it opens for the same bike (or note). In memory
 * only: a parked draft does not survive the app being killed, and nothing is
 * uploaded — photos are the local uris the rider picked.
 */
export interface NoteDraft {
  text: string;
  stampOn: boolean;
  alsoTask: boolean;
  /** The "Attach to" bike. */
  targetId: string;
  /** Local uris of photos picked but not uploaded. */
  newPhotos: string[];
  /** Edit only: ids of the note's photos the rider removed. */
  removedPhotoIds: string[];
  /**
   * The quick-add text the sheet was opened with, if any. A restored draft that
   * is then saved still reports SAVED for it, so the field that handed it off clears.
   */
  handoff?: string;
}

export interface OdometerDraft {
  digits: string;
  /** Epoch ms of the picked date; `null` = today. */
  pickedDate: number | null;
  usedQuickAdd: boolean;
}

interface SheetDraftState {
  notes: Record<string, NoteDraft>;
  readings: Record<string, OdometerDraft>;
  parkNote: (key: string, draft: NoteDraft) => void;
  clearNote: (key: string) => void;
  parkReading: (bikeId: string, draft: OdometerDraft) => void;
  clearReading: (bikeId: string) => void;
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

export const useSheetDraftStore = create<SheetDraftState>()((set) => ({
  notes: {},
  readings: {},
  parkNote: (key, draft) => set((state) => ({ notes: { ...state.notes, [key]: draft } })),
  clearNote: (key) => set((state) => ({ notes: without(state.notes, key) })),
  parkReading: (bikeId, draft) =>
    set((state) => ({ readings: { ...state.readings, [bikeId]: draft } })),
  clearReading: (bikeId) => set((state) => ({ readings: without(state.readings, bikeId) })),
}));

/** One slot per bike for a new note, one per note being edited. */
export function noteDraftKey(bikeId: string, noteId?: string): string {
  return [bikeId, noteId ?? SHEET_DRAFT_KEY.NEW_NOTE].join(SHEET_DRAFT_KEY.SEPARATOR);
}

/** Whether a picked photo's local file is still there (a cache purge can remove it). */
export function localFileExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * The parked Note draft this sheet should restore, or `null`.
 *
 * Hand-off precedence: text handed in from a quick-add field is what the rider
 * just asked to write, so it wins. A parked draft is restored alongside it only
 * when it grew from that SAME hand-off (the rider wrote more, then dragged the
 * sheet away); a draft from anything else is left parked, untouched, and this
 * sheet starts from the handed-off text. Photos whose file is gone are dropped
 * silently; an "Attach to" bike that no longer exists falls back to `bikeId`.
 */
export function restorableNoteDraft(input: {
  key: string;
  bikeId: string;
  bikeIds: readonly string[];
  handoff?: string;
}): NoteDraft | null {
  const parked = useSheetDraftStore.getState().notes[input.key];
  if (!parked) return null;
  const handoff = normaliseNoteText(input.handoff ?? '');
  if (handoff && handoff !== normaliseNoteText(parked.handoff ?? '')) return null;
  return {
    ...parked,
    targetId: input.bikeIds.includes(parked.targetId) ? parked.targetId : input.bikeId,
    newPhotos: parked.newPhotos.filter(localFileExists),
  };
}

/** The parked Odometer draft for this bike, or `null`. */
export function restorableOdometerDraft(bikeId: string): OdometerDraft | null {
  return useSheetDraftStore.getState().readings[bikeId] ?? null;
}
