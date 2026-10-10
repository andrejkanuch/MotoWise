jest.mock('expo-file-system', () => ({
  File: function MockFile(this: { exists: boolean }) {
    this.exists = true;
  },
}));
const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));
const mockRemoveObject = jest.fn();
jest.mock('@/lib/image-upload', () => ({
  removeNotePhotoObject: (...args: unknown[]) => mockRemoveObject(...args),
}));

import { NotesByMotorcycleDocument } from '@motovault/graphql';
import { waitFor } from '@testing-library/react-native';
import {
  DRAFT_STACK_MAX,
  type NoteDraft,
  newDraftToken,
  noteDraftKey,
  useSheetDraftStore,
} from '@/stores/sheet-draft.store';
import {
  clearSheetDrafts,
  parkNoteDraft,
  releaseSheetDraftsForSignOut,
  SIGN_OUT_RELEASE_TIMEOUT_MS,
} from '../notes/unattached-note-photos';

const BIKE = 'bike-a';
const KEY = noteDraftKey(BIKE);
const OTHER_KEY = noteDraftKey(BIKE, 'note-1');
/** Carried only by the draft that leaves the store. */
const ONLY_DROPPED = 'user-1/notes/n/only-dropped.webp';
/** Also carried by a draft still parked in another slot. */
const STILL_PARKED = 'user-1/notes/n/still-parked.webp';
/** Its `addNotePhoto` committed after all (the response was lost): attached to the note. */
const ATTACHED = 'user-1/notes/n/attached.webp';

const upload = (storagePath: string) => ({ storagePath, fileSizeBytes: 1234, motorcycleId: BIKE });

/** A draft whose photos are all already in storage, one per path. */
function storedDraft(paths: readonly string[], text = 'Chain is loud'): NoteDraft {
  const uris = paths.map((_, index) => `file:///photo-${index}.jpg`);
  return {
    text,
    stampOn: true,
    alsoTask: false,
    targetId: BIKE,
    newPhotos: uris,
    removedPhotoIds: [],
    uploaded: Object.fromEntries(uris.map((uri, index) => [uri, upload(paths[index] as string)])),
  };
}
const plainDraft = (text: string): NoteDraft => ({ ...storedDraft([]), text });

const removed = () => mockRemoveObject.mock.calls.map(([path]) => path);
/** Lets the best-effort removal (a notes query, then the removals) run. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
  useSheetDraftStore.setState({ notes: {}, readings: {} });
  mockFetcher.mockImplementation((document: unknown) =>
    document === NotesByMotorcycleDocument
      ? Promise.resolve({ notes: [{ photos: [{ storagePath: ATTACHED }] }] })
      : Promise.reject(new Error('unexpected')),
  );
  mockRemoveObject.mockResolvedValue(undefined);
});

describe('a Note draft pushed past the cap', () => {
  it('releases only the stored objects nothing else carries and that never attached', async () => {
    parkNoteDraft(OTHER_KEY, storedDraft([STILL_PARKED]), newDraftToken());
    parkNoteDraft(KEY, storedDraft([ONLY_DROPPED, STILL_PARKED, ATTACHED]), newDraftToken());
    for (let index = 1; index < DRAFT_STACK_MAX; index += 1) {
      parkNoteDraft(KEY, plainDraft(String(index)), newDraftToken());
    }
    await settle();
    // At the cap: nothing has left the store yet.
    expect(mockRemoveObject).not.toHaveBeenCalled();

    parkNoteDraft(KEY, plainDraft('newest'), newDraftToken());
    await waitFor(() => expect(removed()).toEqual([ONLY_DROPPED]));
    expect(useSheetDraftStore.getState().notes[KEY]).toHaveLength(DRAFT_STACK_MAX);
  });

  it('keeps an object the newest draft (the one that pushed it out) still carries', async () => {
    parkNoteDraft(KEY, storedDraft([ONLY_DROPPED]), newDraftToken());
    for (let index = 1; index < DRAFT_STACK_MAX; index += 1) {
      parkNoteDraft(KEY, plainDraft(String(index)), newDraftToken());
    }
    parkNoteDraft(KEY, storedDraft([ONLY_DROPPED], 'newest'), newDraftToken());
    await settle();
    expect(mockRemoveObject).not.toHaveBeenCalled();
  });

  it('keeps everything when the attached photos cannot be checked', async () => {
    mockFetcher.mockRejectedValue(new Error('offline'));
    parkNoteDraft(KEY, storedDraft([ONLY_DROPPED]), newDraftToken());
    for (let index = 0; index < DRAFT_STACK_MAX; index += 1) {
      parkNoteDraft(KEY, plainDraft(String(index)), newDraftToken());
    }
    await settle();
    expect(mockRemoveObject).not.toHaveBeenCalled();
  });
});

describe('user sign-out (releaseSheetDraftsForSignOut, session still valid)', () => {
  it('drops every draft and releases the stored objects that never attached', async () => {
    parkNoteDraft(KEY, storedDraft([ONLY_DROPPED, ATTACHED]), newDraftToken());
    parkNoteDraft(OTHER_KEY, storedDraft([STILL_PARKED]), newDraftToken());
    useSheetDraftStore
      .getState()
      .parkReading(BIKE, { digits: '1', pickedDate: null, usedQuickAdd: false }, newDraftToken());

    await releaseSheetDraftsForSignOut();
    expect(useSheetDraftStore.getState().notes).toEqual({});
    expect(useSheetDraftStore.getState().readings).toEqual({});
    expect(removed().sort()).toEqual([ONLY_DROPPED, STILL_PARKED].sort());
    expect(removed()).not.toContain(ATTACHED);
  });

  it('nothing parked: removes nothing and queries nothing', async () => {
    await releaseSheetDraftsForSignOut();
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(mockRemoveObject).not.toHaveBeenCalled();
  });

  it('a hanging network does not hold sign-out past the timeout', async () => {
    jest.useFakeTimers();
    try {
      mockFetcher.mockImplementation(() => new Promise(() => {}));
      parkNoteDraft(KEY, storedDraft([ONLY_DROPPED]), newDraftToken());
      const released = releaseSheetDraftsForSignOut();
      jest.advanceTimersByTime(SIGN_OUT_RELEASE_TIMEOUT_MS);
      await expect(released).resolves.toBeUndefined();
      expect(useSheetDraftStore.getState().notes).toEqual({});
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('session already gone (clearSheetDrafts)', () => {
  it('drops every draft without trying to remove anything', async () => {
    parkNoteDraft(KEY, storedDraft([ONLY_DROPPED]), newDraftToken());
    useSheetDraftStore
      .getState()
      .parkReading(BIKE, { digits: '1', pickedDate: null, usedQuickAdd: false }, newDraftToken());

    clearSheetDrafts();
    expect(useSheetDraftStore.getState().notes).toEqual({});
    expect(useSheetDraftStore.getState().readings).toEqual({});
    await settle();
    // Without a session the attached-check and the delete are both refused.
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(mockRemoveObject).not.toHaveBeenCalled();
  });
});
