import { NotesByMotorcycleDocument } from '@motovault/graphql';
import { gqlFetcher } from '../../../lib/graphql-client';
import { removeNotePhotoObject } from '../../../lib/image-upload';
import {
  type NoteDraft,
  type ParkedPhotoUpload,
  parkedPhotoPaths,
  useSheetDraftStore,
} from '../../../stores/sheet-draft.store';

/**
 * Deletes uploaded objects that never got a `note_photos` row. An unconfirmed
 * `addNotePhoto` may still have committed (its response lost), so each path is
 * checked against the note's attached photos first; a path that is attached, or
 * that cannot be checked, is left alone — a leaked object is better than a
 * saved photo whose file is gone.
 */
export async function removeUnattachedNotePhotos(
  pending: readonly ParkedPhotoUpload[],
): Promise<void> {
  const byBike = new Map<string, ParkedPhotoUpload[]>();
  for (const photo of pending) {
    byBike.set(photo.motorcycleId, [...(byBike.get(photo.motorcycleId) ?? []), photo]);
  }
  await Promise.all(
    [...byBike].map(async ([motorcycleId, photos]) => {
      let attached: Set<string>;
      try {
        const { notes } = await gqlFetcher(NotesByMotorcycleDocument, { motorcycleId });
        attached = new Set(notes.flatMap((note) => note.photos.map((photo) => photo.storagePath)));
      } catch {
        return;
      }
      await Promise.all(
        photos
          .filter((photo) => !attached.has(photo.storagePath))
          .map((photo) => removeNotePhotoObject(photo.storagePath)),
      );
    }),
  );
}

/**
 * Note drafts that left the store with no sheet holding them (pushed past
 * `DRAFT_STACK_MAX`, or dropped on sign-out): removes the uploaded objects they
 * carried, best-effort — unless a draft still parked points at the same object
 * (it re-attaches it), and never one that is attached to its note.
 */
export function releaseDroppedNoteDrafts(dropped: readonly NoteDraft[]): void {
  if (dropped.length === 0) return;
  const carried = parkedPhotoPaths();
  const orphans = new Map<string, ParkedPhotoUpload>();
  for (const draft of dropped) {
    for (const upload of Object.values(draft.uploaded ?? {})) {
      if (!carried.has(upload.storagePath)) orphans.set(upload.storagePath, upload);
    }
  }
  if (orphans.size === 0) return;
  void removeUnattachedNotePhotos([...orphans.values()]);
}

/** Parks a Note draft as the slot's newest, releasing the stored photos of any draft it pushes out. */
export function parkNoteDraft(key: string, draft: NoteDraft, token: string): void {
  releaseDroppedNoteDrafts(useSheetDraftStore.getState().parkNote(key, draft, token));
}

/** Sign-out: drops every parked draft and releases the stored photos only they carried. */
export function clearSheetDrafts(): void {
  releaseDroppedNoteDrafts(useSheetDraftStore.getState().clearAll());
}
