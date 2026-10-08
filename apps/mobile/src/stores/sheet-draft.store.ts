import { File } from 'expo-file-system';
import { create } from 'zustand';
import { SHEET_DRAFT_KEY } from '../lib/bike-hub/constants';
import { normaliseNoteText } from '../lib/bike-hub/notes';

/** A photo already uploaded to storage but not attached to its note. */
export interface ParkedPhotoUpload {
  storagePath: string;
  fileSizeBytes: number;
  /** Bike of the note — the notes query that lists the note's attached photos. */
  motorcycleId: string;
}

/**
 * Work a hub form sheet was holding when it left the screen without a decision.
 *
 * Android's draggable form sheet ignores `preventNativeDismiss` (react-native-
 * screens 4.26), so a drag-down cannot be held back and asked about the way the
 * iOS swipe is. Instead of losing what was typed, the sheet parks it here and
 * offers it back the next time it opens for the same bike (or note). In memory
 * only: a parked draft does not survive the app being killed (and is dropped on
 * sign-out). Photos are the local uris the rider picked; a photo whose file is
 * already in storage (its `addNotePhoto` failed) also carries that object, so a
 * restored sheet attaches it instead of uploading a second copy.
 */
export interface NoteDraft {
  text: string;
  stampOn: boolean;
  alsoTask: boolean;
  /** The "Attach to" bike. */
  targetId: string;
  /** Local uris of photos picked but not attached. */
  newPhotos: string[];
  /** Edit only: ids of the note's photos the rider removed. */
  removedPhotoIds: string[];
  /**
   * The quick-add text the sheet was opened with, if any. A restored draft that
   * is then saved still reports SAVED for it, so the field that handed it off clears.
   */
  handoff?: string;
  /** By local uri: photos of `newPhotos` whose file is already in storage. */
  uploaded?: Record<string, ParkedPhotoUpload>;
}

export interface OdometerDraft {
  digits: string;
  /** Epoch ms of the picked date; `null` = today. */
  pickedDate: number | null;
  usedQuickAdd: boolean;
}

/**
 * A parked draft and the token of the sheet (or failed save) that parked it.
 * Only that token may replace or remove its entry: a save that lands (or
 * fails) after its sheet is gone never touches work a later sheet parked.
 */
export interface ParkedDraft<T> {
  draft: T;
  token: string;
}

/**
 * Most drafts one slot keeps. A slot is a stack, newest first, so parking never
 * refuses: two sheets for the same bike whose work overlaps (one dragged away
 * mid-save and reopened, then the first save fails) both keep theirs. Past the
 * cap the OLDEST draft is dropped — reaching it takes five abandoned sheets for
 * one bike in one session, and the newest work is what the rider expects back.
 */
export const DRAFT_STACK_MAX = 5;

/** Newest first. */
type Stack<T> = readonly ParkedDraft<T>[];
type Slots<T> = Record<string, Stack<T>>;

interface SheetDraftState {
  notes: Slots<NoteDraft>;
  readings: Slots<OdometerDraft>;
  /** Parks `draft` as the newest of the slot, replacing `token`'s own earlier entry. */
  parkNote: (key: string, draft: NoteDraft, token: string) => void;
  /** Removes `token`'s entry only; the slot's other drafts stay. */
  clearNote: (key: string, token: string) => void;
  parkReading: (bikeId: string, draft: OdometerDraft, token: string) => void;
  clearReading: (bikeId: string, token: string) => void;
  /** Sign-out: drafts belong to the session that wrote them. */
  clearAll: () => void;
}

function withStack<T>(slots: Slots<T>, key: string, stack: Stack<T>): Slots<T> {
  if (stack.length > 0) return { ...slots, [key]: stack };
  const { [key]: _removed, ...rest } = slots;
  return rest;
}

function withoutToken<T>(stack: Stack<T> | undefined, token: string): Stack<T> {
  return (stack ?? []).filter((entry) => entry.token !== token);
}

function pushed<T>(slots: Slots<T>, key: string, draft: T, token: string): Slots<T> {
  const stack = [{ draft, token }, ...withoutToken(slots[key], token)].slice(0, DRAFT_STACK_MAX);
  return withStack(slots, key, stack);
}

function cleared<T>(slots: Slots<T>, key: string, token: string): Slots<T> {
  if (!slots[key]) return slots;
  return withStack(slots, key, withoutToken(slots[key], token));
}

export const useSheetDraftStore = create<SheetDraftState>()((set) => ({
  notes: {},
  readings: {},
  parkNote: (key, draft, token) =>
    set((state) => ({ notes: pushed(state.notes, key, draft, token) })),
  clearNote: (key, token) => set((state) => ({ notes: cleared(state.notes, key, token) })),
  parkReading: (bikeId, draft, token) =>
    set((state) => ({ readings: pushed(state.readings, bikeId, draft, token) })),
  clearReading: (bikeId, token) =>
    set((state) => ({ readings: cleared(state.readings, bikeId, token) })),
  clearAll: () => set({ notes: {}, readings: {} }),
}));

/** Storage paths of every uploaded photo a parked Note draft still points at. */
export function parkedPhotoPaths(): Set<string> {
  const paths = new Set<string>();
  for (const stack of Object.values(useSheetDraftStore.getState().notes)) {
    for (const { draft } of stack) {
      for (const upload of Object.values(draft.uploaded ?? {})) paths.add(upload.storagePath);
    }
  }
  return paths;
}

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
 * The parked Note draft this sheet should restore, or `null`: the newest one it
 * may take. The others stay parked and are offered, newest first, the next
 * times the sheet opens.
 *
 * Hand-off precedence: text handed in from a quick-add field is what the rider
 * just asked to write, so it wins. A parked draft is restored alongside it only
 * when it grew from that SAME hand-off (the rider wrote more, then dragged the
 * sheet away); drafts from anything else are left parked, untouched, and this
 * sheet starts from the handed-off text. Photos whose file is gone are dropped
 * silently unless already uploaded; an "Attach to" bike that no longer exists
 * falls back to `bikeId`.
 */
export function restorableNoteDraft(input: {
  key: string;
  bikeId: string;
  bikeIds: readonly string[];
  handoff?: string;
}): ParkedDraft<NoteDraft> | null {
  const handoff = normaliseNoteText(input.handoff ?? '');
  const parked = (useSheetDraftStore.getState().notes[input.key] ?? []).find(
    ({ draft }) => !handoff || handoff === normaliseNoteText(draft.handoff ?? ''),
  );
  if (!parked) return null;
  const { draft, token } = parked;
  return {
    token,
    draft: {
      ...draft,
      targetId: input.bikeIds.includes(draft.targetId) ? draft.targetId : input.bikeId,
      newPhotos: draft.newPhotos.filter((uri) => !!draft.uploaded?.[uri] || localFileExists(uri)),
    },
  };
}

/** The newest parked Odometer draft for this bike, or `null` (the rest stay parked). */
export function restorableOdometerDraft(bikeId: string): ParkedDraft<OdometerDraft> | null {
  return useSheetDraftStore.getState().readings[bikeId]?.[0] ?? null;
}
