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
 * only: a parked draft does not survive the app being killed (and is dropped on
 * sign-out), and nothing is uploaded — photos are the local uris the rider picked.
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

/**
 * A parked draft and the token of the sheet that holds its slot. Only that
 * sheet may overwrite or clear it: a save that lands (or fails) after its sheet
 * is gone never touches work a later sheet for the same bike parked, and a
 * sheet that chose not to restore a draft never parks over it.
 */
export interface ParkedDraft<T> {
  draft: T;
  token: string;
}

type Slots<T> = Record<string, ParkedDraft<T>>;

interface SheetDraftState {
  notes: Slots<NoteDraft>;
  readings: Slots<OdometerDraft>;
  /** Parks `draft` unless the slot is held by another token; returns whether it did. */
  parkNote: (key: string, draft: NoteDraft, token: string) => boolean;
  /** Empties the slot when `token` holds it. */
  clearNote: (key: string, token: string) => void;
  parkReading: (bikeId: string, draft: OdometerDraft, token: string) => boolean;
  clearReading: (bikeId: string, token: string) => void;
  /** Sign-out: drafts belong to the session that wrote them. */
  clearAll: () => void;
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

/** Whether `token` may write the slot: it is free or already `token`'s. */
function mayPark<T>(slots: Slots<T>, key: string, token: string): boolean {
  const held = slots[key];
  return !held || held.token === token;
}

function clearHeld<T>(slots: Slots<T>, key: string, token: string): Slots<T> {
  return slots[key]?.token === token ? without(slots, key) : slots;
}

export const useSheetDraftStore = create<SheetDraftState>()((set, get) => ({
  notes: {},
  readings: {},
  parkNote: (key, draft, token) => {
    if (!mayPark(get().notes, key, token)) return false;
    set((state) => ({ notes: { ...state.notes, [key]: { draft, token } } }));
    return true;
  },
  clearNote: (key, token) => set((state) => ({ notes: clearHeld(state.notes, key, token) })),
  parkReading: (bikeId, draft, token) => {
    if (!mayPark(get().readings, bikeId, token)) return false;
    set((state) => ({ readings: { ...state.readings, [bikeId]: { draft, token } } }));
    return true;
  },
  clearReading: (bikeId, token) =>
    set((state) => ({ readings: clearHeld(state.readings, bikeId, token) })),
  clearAll: () => set({ notes: {}, readings: {} }),
}));

let lastDraftToken = 0;

/** A token for a sheet that has not restored a draft (each sheet instance gets its own). */
export function newDraftToken(): string {
  lastDraftToken += 1;
  return String(lastDraftToken);
}

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
}): ParkedDraft<NoteDraft> | null {
  const parked = useSheetDraftStore.getState().notes[input.key];
  if (!parked) return null;
  const { draft, token } = parked;
  const handoff = normaliseNoteText(input.handoff ?? '');
  if (handoff && handoff !== normaliseNoteText(draft.handoff ?? '')) return null;
  return {
    token,
    draft: {
      ...draft,
      targetId: input.bikeIds.includes(draft.targetId) ? draft.targetId : input.bikeId,
      newPhotos: draft.newPhotos.filter(localFileExists),
    },
  };
}

/** The parked Odometer draft for this bike, or `null`. */
export function restorableOdometerDraft(bikeId: string): ParkedDraft<OdometerDraft> | null {
  return useSheetDraftStore.getState().readings[bikeId] ?? null;
}
