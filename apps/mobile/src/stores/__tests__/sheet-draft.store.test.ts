/** Picked photos whose file is gone (a cache purge) have "gone" in their uri. */
jest.mock('expo-file-system', () => ({
  File: function MockFile(this: { exists: boolean }, uri: string) {
    this.exists = !uri.includes('gone');
  },
}));

import {
  DRAFT_STACK_MAX,
  type NoteDraft,
  newDraftToken,
  noteDraftKey,
  type OdometerDraft,
  parkedPhotoPaths,
  restorableNoteDraft,
  restorableOdometerDraft,
  useSheetDraftStore,
} from '../sheet-draft.store';

const BIKE = 'bike-a';
const OTHER_BIKE = 'bike-b';
const KEY = noteDraftKey(BIKE);

const NOTE: NoteDraft = {
  text: 'Chain is loud',
  stampOn: true,
  alsoTask: false,
  targetId: OTHER_BIKE,
  newPhotos: ['file:///kept.jpg', 'file:///gone.jpg'],
  removedPhotoIds: [],
  handoff: 'Chain',
};
const READING: OdometerDraft = { digits: '12345', pickedDate: null, usedQuickAdd: false };

const store = () => useSheetDraftStore.getState();

beforeEach(() => {
  useSheetDraftStore.setState({ notes: {}, readings: {} });
});

describe('sheet-draft store — a newest-first stack per slot', () => {
  it('a token re-parking replaces its own entry and moves it to the top', () => {
    const token = newDraftToken();
    const other = newDraftToken();
    store().parkNote(KEY, NOTE, token);
    store().parkNote(KEY, { ...NOTE, text: 'Other' }, other);
    store().parkNote(KEY, { ...NOTE, text: 'More' }, token);
    expect(store().notes[KEY]).toEqual([
      { draft: { ...NOTE, text: 'More' }, token },
      { draft: { ...NOTE, text: 'Other' }, token: other },
    ]);
  });

  it('another token parks beside a held entry, never over it, and clears only its own', () => {
    const holder = newDraftToken();
    const other = newDraftToken();
    store().parkReading(BIKE, READING, holder);
    store().parkReading(BIKE, { ...READING, digits: '1' }, other);
    expect(store().readings[BIKE]).toEqual([
      { draft: { ...READING, digits: '1' }, token: other },
      { draft: READING, token: holder },
    ]);

    store().clearReading(BIKE, other);
    expect(store().readings[BIKE]).toEqual([{ draft: READING, token: holder }]);
    store().clearReading(BIKE, 'nobody');
    expect(store().readings[BIKE]).toEqual([{ draft: READING, token: holder }]);

    store().clearReading(BIKE, holder);
    expect(store().readings[BIKE]).toBeUndefined();
  });

  it(`keeps at most ${DRAFT_STACK_MAX} drafts per slot, dropping the oldest`, () => {
    const tokens = Array.from({ length: DRAFT_STACK_MAX + 2 }, () => newDraftToken());
    tokens.forEach((token, index) => {
      store().parkReading(BIKE, { ...READING, digits: String(index) }, token);
    });
    const stack = store().readings[BIKE] ?? [];
    expect(stack).toHaveLength(DRAFT_STACK_MAX);
    // Newest first; the two oldest (0 and 1) are gone.
    expect(stack.map((entry) => entry.draft.digits)).toEqual(['6', '5', '4', '3', '2']);
    expect(restorableOdometerDraft(BIKE)?.draft.digits).toBe('6');
  });

  it('every sheet gets a distinct token', () => {
    expect(newDraftToken()).not.toBe(newDraftToken());
  });

  it('clearAll (sign-out) drops every parked draft', () => {
    store().parkNote(KEY, NOTE, newDraftToken());
    store().parkReading(BIKE, READING, newDraftToken());
    store().clearAll();
    expect(store().notes).toEqual({});
    expect(store().readings).toEqual({});
  });

  it('parkedPhotoPaths lists the stored objects parked drafts still carry', () => {
    const upload = { storagePath: 'user-1/notes/n1/1.webp', fileSizeBytes: 10, motorcycleId: BIKE };
    store().parkNote(KEY, NOTE, newDraftToken());
    store().parkNote(
      noteDraftKey(BIKE, 'n1'),
      { ...NOTE, uploaded: { 'file:///kept.jpg': upload } },
      newDraftToken(),
    );
    expect([...parkedPhotoPaths()]).toEqual([upload.storagePath]);
  });
});

describe('restorableNoteDraft', () => {
  it('falls back to the sheet’s bike when the "Attach to" bike no longer exists', () => {
    const token = newDraftToken();
    store().parkNote(KEY, NOTE, token);

    const restored = restorableNoteDraft({ key: KEY, bikeId: BIKE, bikeIds: [BIKE] });

    expect(restored?.token).toBe(token);
    expect(restored?.draft.targetId).toBe(BIKE);
    // The photo whose file was purged is dropped; the parked entry is untouched.
    expect(restored?.draft.newPhotos).toEqual(['file:///kept.jpg']);
    expect(store().notes[KEY]?.[0]?.draft).toEqual(NOTE);
  });

  it('keeps an "Attach to" bike that still exists', () => {
    store().parkNote(KEY, NOTE, newDraftToken());
    const restored = restorableNoteDraft({ key: KEY, bikeId: BIKE, bikeIds: [BIKE, OTHER_BIKE] });
    expect(restored?.draft.targetId).toBe(OTHER_BIKE);
  });

  it('a different hand-off does not restore; the same one (normalised) does', () => {
    store().parkNote(KEY, NOTE, newDraftToken());
    const input = { key: KEY, bikeId: BIKE, bikeIds: [BIKE, OTHER_BIKE] };
    expect(restorableNoteDraft({ ...input, handoff: 'Bought oil' })).toBeNull();
    expect(restorableNoteDraft({ ...input, handoff: '  Chain ' })).not.toBeNull();
  });

  it('offers the newest draft first; the next one once that is cleared', () => {
    const older = newDraftToken();
    const newer = newDraftToken();
    store().parkNote(KEY, { ...NOTE, text: 'Older' }, older);
    store().parkNote(KEY, { ...NOTE, text: 'Newer' }, newer);
    const input = { key: KEY, bikeId: BIKE, bikeIds: [BIKE] };
    expect(restorableNoteDraft(input)?.draft.text).toBe('Newer');
    store().clearNote(KEY, newer);
    expect(restorableNoteDraft(input)?.draft.text).toBe('Older');
  });

  it('with a hand-off, the newest draft grown from that hand-off', () => {
    store().parkNote(KEY, NOTE, newDraftToken());
    store().parkNote(KEY, { ...NOTE, text: 'Oil', handoff: 'Bought oil' }, newDraftToken());
    const input = { key: KEY, bikeId: BIKE, bikeIds: [BIKE] };
    expect(restorableNoteDraft({ ...input, handoff: 'Chain' })?.draft.text).toBe(NOTE.text);
    expect(restorableNoteDraft(input)?.draft.text).toBe('Oil');
  });

  it('keeps an already-uploaded photo whose local file is gone', () => {
    const upload = { storagePath: 'user-1/notes/n1/1.webp', fileSizeBytes: 10, motorcycleId: BIKE };
    store().parkNote(KEY, { ...NOTE, uploaded: { 'file:///gone.jpg': upload } }, newDraftToken());
    const restored = restorableNoteDraft({ key: KEY, bikeId: BIKE, bikeIds: [BIKE] });
    expect(restored?.draft.newPhotos).toEqual(['file:///kept.jpg', 'file:///gone.jpg']);
  });

  it('nothing parked: null', () => {
    expect(restorableNoteDraft({ key: KEY, bikeId: BIKE, bikeIds: [BIKE] })).toBeNull();
    expect(restorableOdometerDraft(BIKE)).toBeNull();
  });
});
