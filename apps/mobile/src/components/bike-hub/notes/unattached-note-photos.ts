import { NotesByMotorcycleDocument } from '@motovault/graphql';
import { gqlFetcher } from '@/lib/graphql-client';
import { removeNotePhotoObject } from '@/lib/image-upload';
import {
  type NoteDraft,
  type ParkedPhotoUpload,
  parkedPhotoPaths,
  useSheetDraftStore,
} from '@/stores/sheet-draft.store';

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
 * How long a user-initiated sign-out waits for the parked drafts' photos to be
 * released. Removal needs the session, so it has to finish before sign-out;
 * this caps the delay on a slow network (objects left behind are leaked, never
 * a saved photo lost).
 */
export const SIGN_OUT_RELEASE_TIMEOUT_MS = 3_000;

/**
 * Uploaded objects carried by `dropped` that no draft still parked points at
 * (a parked draft re-attaches them).
 */
function orphanedUploads(dropped: readonly NoteDraft[]): ParkedPhotoUpload[] {
  const carried = parkedPhotoPaths();
  const orphans = new Map<string, ParkedPhotoUpload>();
  for (const draft of dropped) {
    for (const upload of Object.values(draft.uploaded ?? {})) {
      if (!carried.has(upload.storagePath)) orphans.set(upload.storagePath, upload);
    }
  }
  return [...orphans.values()];
}

/**
 * Note drafts pushed past `DRAFT_STACK_MAX`, with no sheet holding them: removes
 * the uploaded objects only they carried, best-effort, and never one that is
 * attached to its note.
 */
export function releaseDroppedNoteDrafts(dropped: readonly NoteDraft[]): void {
  const orphans = orphanedUploads(dropped);
  if (orphans.length === 0) return;
  void removeUnattachedNotePhotos(orphans);
}

/** Parks a Note draft as the slot's newest, releasing the stored photos of any draft it pushes out. */
export function parkNoteDraft(key: string, draft: NoteDraft, token: string): void {
  releaseDroppedNoteDrafts(useSheetDraftStore.getState().parkNote(key, draft, token));
}

/**
 * User-initiated sign-out, called BEFORE the session ends: drops every parked
 * draft and removes the stored photos only they carried, waiting at most
 * `SIGN_OUT_RELEASE_TIMEOUT_MS`. Once the session is gone the attached-check and
 * the storage delete are both refused, so this cannot run from the auth listener.
 */
export async function releaseSheetDraftsForSignOut(): Promise<void> {
  const orphans = orphanedUploads(useSheetDraftStore.getState().clearAll());
  if (orphans.length === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, SIGN_OUT_RELEASE_TIMEOUT_MS);
  });
  try {
    await Promise.race([removeUnattachedNotePhotos(orphans), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Session already gone (any sign-out, including a server-revoked session):
 * drops every parked draft. Store-only — without a session nothing can be
 * removed, so photos a forced sign-out leaves behind stay in storage.
 */
export function clearSheetDrafts(): void {
  useSheetDraftStore.getState().clearAll();
}
