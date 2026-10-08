import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { REQUEST_TIMEOUT_MESSAGE } from './graphql-error-classification';
import { supabase } from './supabase';

const WEBP_CONTENT_TYPE = 'image/webp';
const BIKE_PHOTOS_BUCKET = 'bike-photos';
const MAINTENANCE_PHOTOS_BUCKET = 'maintenance-photos';
const RECEIPTS_BUCKET = 'receipts';

/** Receipt compression profile (KTD-8): ≥1920px, mild — invoice text must stay
 *  legible, so it is NOT the lossy 1200px/0.7 gallery profile. */
const RECEIPT_MAX_WIDTH = 1920;
const RECEIPT_COMPRESS = 0.85;

/**
 * Upper bound on one Storage upload. Photos are compressed to ~100–400 KB WebP
 * before upload (receipts up to ~1 MB), so a minute covers a slow cellular link;
 * past that the save is treated as failed so the sheet that is waiting on it
 * unlocks instead of hanging until the OS network timeout.
 */
export const STORAGE_UPLOAD_TIMEOUT_MS = 60_000;

/**
 * A Storage upload did not settle within `STORAGE_UPLOAD_TIMEOUT_MS`. Its
 * message starts with `REQUEST_TIMEOUT_MESSAGE`, so `isNetworkError` and
 * `userFriendlyError` treat it like any other transient connectivity failure.
 */
export class StorageUploadTimeoutError extends Error {
  constructor(bucket: string, timeoutMs: number) {
    super(`${REQUEST_TIMEOUT_MESSAGE} (storage upload to ${bucket}, timeout ${timeoutMs}ms)`);
    this.name = 'StorageUploadTimeoutError';
  }
}

type UploadOptions = { contentType: string; upsert: boolean };

/**
 * `supabase.storage.from(bucket).upload` with a deadline.
 *
 * Why a race and not an AbortSignal: storage-js 2.108's `upload(path, fileBody,
 * fileOptions)` has no fetch-parameters argument and `FileOptions` has no
 * `signal` (only download/info/exists/list-style calls take one), so the request
 * cannot be cancelled from here. On timeout the caller gets a rejection and the
 * HTTP request is left to finish or fail on its own. What a late landing does
 * depends on the path:
 * - Shared-folder photos (task, note, expense) get a fresh `uniquePhotoName()`
 *   per call: a late object is an orphan with no DB row (the harmless case
 *   `removeNotePhotoObject` describes) and never collides with a retry.
 * - A receipt is keyed by its `scanId` and a retry sends the same image, so a
 *   late `upsert: true` landing rewrites identical content.
 * - The bike hero has ONE fixed path per bike (`upsert: true`). If the rider
 *   retries with a DIFFERENT photo and the timed-out first upload lands after
 *   the retry, the first photo silently wins. Accepted residual: it needs a
 *   stalled upload that outlives the deadline and then completes, followed by a
 *   different pick, and the rider can set the photo again. Guarding it would
 *   mean per-upload paths for the hero (and cleaning up the old object), which
 *   the onboarding `{userId}/onboarding/hero.webp` hand-off does not allow today.
 */
async function uploadWithTimeout(
  bucket: string,
  filePath: string,
  bytes: Uint8Array,
  options: UploadOptions,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new StorageUploadTimeoutError(bucket, STORAGE_UPLOAD_TIMEOUT_MS)),
      STORAGE_UPLOAD_TIMEOUT_MS,
    );
  });
  try {
    const { error } = await Promise.race([
      supabase.storage.from(bucket).upload(filePath, bytes, options),
      deadline,
    ]);
    if (error) throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * File name of a photo in a shared folder (a task's or a note's). Photos of one
 * save upload side by side, so a timestamp alone can repeat within the same
 * millisecond and the second `upsert: false` upload would fail; the UUID keeps
 * every name unique while the timestamp keeps them in upload order.
 */
export function uniquePhotoName(): string {
  return `${Date.now()}-${Crypto.randomUUID()}.webp`;
}

export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled) return null;
  return result.assets[0].uri;
}

export async function compressImage(uri: string, maxWidth = 1200): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: maxWidth } }], {
    compress: 0.7,
    format: SaveFormat.WEBP,
  });
  return result.uri;
}

/**
 * Receipt compression profile (KTD-8): ≥1920px, mild compression. Invoice text
 * (amounts, dates, odometer) must survive extraction, so this deliberately does
 * NOT use the lossy 1200px/0.7 gallery profile.
 */
export async function compressReceiptImage(uri: string): Promise<string> {
  const result = await manipulateAsync(uri, [{ resize: { width: RECEIPT_MAX_WIDTH } }], {
    compress: RECEIPT_COMPRESS,
    format: SaveFormat.WEBP,
  });
  return result.uri;
}

/**
 * Compress an image and read it back as raw bytes ready for Supabase Storage.
 *
 * Reads via expo-file-system's `File.bytes()` (a native byte read) instead of
 * `fetch(uri).arrayBuffer()` — the latter is unreliable on React Native/Hermes
 * and can silently resolve to a 0-byte buffer, producing an empty upload.
 *
 * `compress` is parameterized (default: the gallery profile) so receipt uploads
 * can pass `compressReceiptImage` without the two profiles drifting apart.
 */
async function readImageBytes(
  uri: string,
  compress: (uri: string) => Promise<string> = compressImage,
): Promise<Uint8Array> {
  const compressedUri = await compress(uri);
  return new File(compressedUri).bytes();
}

/**
 * Upload a bike's hero photo to Supabase Storage and return its public URL.
 *
 * Pass `motorcycleId` for an existing bike (canonical per-bike path). During
 * onboarding the bike row does not exist yet, so omit it — the object is keyed
 * by user only (`{userId}/onboarding/hero.webp`) and the returned URL is handed
 * to `complete_onboarding`, which stores it as `primary_photo_url` on creation.
 * Bucket RLS only requires the first path segment to match the uid; motorcycleId
 * is a UUID, so it never collides with the literal `onboarding` segment.
 */
export async function uploadBikePhoto(
  uri: string,
  userId: string,
  motorcycleId?: string,
): Promise<{ publicUrl: string }> {
  const bytes = await readImageBytes(uri);
  const filePath = `${userId}/${motorcycleId ?? 'onboarding'}/hero.webp`;
  await uploadWithTimeout(BIKE_PHOTOS_BUCKET, filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: true,
  });
  const {
    data: { publicUrl },
  } = supabase.storage.from(BIKE_PHOTOS_BUCKET).getPublicUrl(filePath);
  // Append cache-buster so CDN/expo-image shows the new image after re-upload.
  return { publicUrl: `${publicUrl}?t=${Date.now()}` };
}

export async function uploadMaintenancePhoto(
  uri: string,
  userId: string,
  taskId: string,
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const bytes = await readImageBytes(uri);
  const filePath = `${userId}/${taskId}/${uniquePhotoName()}`;
  await uploadWithTimeout(MAINTENANCE_PHOTOS_BUCKET, filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: false,
  });
  return {
    storagePath: filePath,
    fileSizeBytes: bytes.byteLength,
  };
}

/**
 * Upload a photo for a bike note.
 *
 * Same public 'maintenance-photos' bucket and compression as task photos, under
 * `{userId}/notes/{noteId}/…` — the prefix `addNotePhoto` requires. The bucket
 * policy only checks that the first folder is the uid, so no new policy.
 */
export async function uploadNotePhoto(
  uri: string,
  userId: string,
  noteId: string,
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const bytes = await readImageBytes(uri);
  const filePath = `${userId}/notes/${noteId}/${uniquePhotoName()}`;
  await uploadWithTimeout(MAINTENANCE_PHOTOS_BUCKET, filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: false,
  });
  return { storagePath: filePath, fileSizeBytes: bytes.byteLength };
}

/**
 * Best-effort removal of a note photo object that never got its `note_photos`
 * row (the upload worked, `addNotePhoto` did not). Never throws: the worst case
 * is the orphan this tries to clean up.
 */
export async function removeNotePhotoObject(storagePath: string): Promise<void> {
  try {
    await supabase.storage.from(MAINTENANCE_PHOTOS_BUCKET).remove([storagePath]);
  } catch {
    // Orphan stays; nothing references it.
  }
}

/**
 * Upload a scanned receipt to the PRIVATE `receipts` bucket (KTD-8/KTD-2).
 *
 * Path is exactly `{userId}/{scanId}.webp` — the server derives the same path
 * from the authenticated uid (never the client's), and the 00167 storage policy
 * enforces the `{uid}/{uuid}.webp` shape. `scanId` is a client-generated UUID.
 * Uses the mild receipt compression profile so invoice text stays legible.
 * `upsert: true` so an offline retry of the same scanId overwrites cleanly.
 * Returns only the storage path — the bucket is private (no public URL).
 */
export async function uploadReceiptPhoto(
  uri: string,
  userId: string,
  scanId: string,
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const bytes = await readImageBytes(uri, compressReceiptImage);
  const filePath = `${userId}/${scanId}.webp`;
  await uploadWithTimeout(RECEIPTS_BUCKET, filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: true,
  });
  return {
    storagePath: filePath,
    fileSizeBytes: bytes.byteLength,
  };
}

/**
 * Upload a receipt photo for an expense.
 *
 * Reuses the existing 'maintenance-photos' bucket with an `expenses/` path prefix
 * so we inherit the same RLS policies (uid must match the first folder segment).
 * MOT-143
 */
export async function uploadExpensePhoto(
  uri: string,
  userId: string,
  expenseId: string,
): Promise<{ storagePath: string; fileSizeBytes: number }> {
  const bytes = await readImageBytes(uri);
  const filePath = `${userId}/expenses/${expenseId}/${uniquePhotoName()}`;
  await uploadWithTimeout(MAINTENANCE_PHOTOS_BUCKET, filePath, bytes, {
    contentType: WEBP_CONTENT_TYPE,
    upsert: false,
  });
  return {
    storagePath: filePath,
    fileSizeBytes: bytes.byteLength,
  };
}
