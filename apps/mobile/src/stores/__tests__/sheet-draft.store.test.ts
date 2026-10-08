/** Picked photos whose file is gone (a cache purge) have "gone" in their uri. */
jest.mock('expo-file-system', () => ({
  File: function MockFile(this: { exists: boolean }, uri: string) {
    this.exists = !uri.includes('gone');
  },
}));

import {
  type NoteDraft,
  newDraftToken,
  noteDraftKey,
  type OdometerDraft,
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

describe('sheet-draft store — slot ownership', () => {
  it('a token parks into a free slot and may overwrite its own', () => {
    const token = newDraftToken();
    expect(store().parkNote(KEY, NOTE, token)).toBe(true);
    expect(store().parkNote(KEY, { ...NOTE, text: 'More' }, token)).toBe(true);
    expect(store().notes[KEY]).toEqual({ draft: { ...NOTE, text: 'More' }, token });
  });

  it('another token cannot park over a held slot or clear it', () => {
    const holder = newDraftToken();
    const other = newDraftToken();
    store().parkReading(BIKE, READING, holder);

    expect(store().parkReading(BIKE, { ...READING, digits: '1' }, other)).toBe(false);
    store().clearReading(BIKE, other);
    expect(store().readings[BIKE]).toEqual({ draft: READING, token: holder });

    store().clearReading(BIKE, holder);
    expect(store().readings[BIKE]).toBeUndefined();
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
    expect(store().notes[KEY]?.draft).toEqual(NOTE);
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

  it('nothing parked: null', () => {
    expect(restorableNoteDraft({ key: KEY, bikeId: BIKE, bikeIds: [BIKE] })).toBeNull();
    expect(restorableOdometerDraft(BIKE)).toBeNull();
  });
});
