import type { Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Photo storage buckets (U7a / receipt-scan R5).
 *
 * Legacy expense + maintenance photos live in the PUBLIC `maintenance-photos`
 * bucket (unauthenticated public URLs). Receipt-linked photos live in the
 * PRIVATE `receipts` bucket (00167) — signed URLs only. The `bucket`
 * discriminator column (00166) on `expense_photos` / `maintenance_task_photos`
 * records which one a row's `storage_path` points at.
 *
 * The string `'receipts'` is intentionally duplicated with
 * `receipt-scan.constants.RECEIPTS_BUCKET` — `src/common` must not depend on a
 * feature module, so the photo-resolution layer owns its own bucket names. Both
 * are named `as const` constants, not magic strings, and both mirror the SQL in
 * 00166/00167 (the acknowledged SQL/TS duplication).
 */
export const PHOTO_BUCKETS = {
  /** Legacy/default public bucket — historical byte-identical public URLs. */
  MAINTENANCE_PHOTOS: 'maintenance-photos',
  /** Private bucket for receipt-scan images — signed URLs only (KTD-2). */
  RECEIPTS: 'receipts',
} as const;

export type PhotoBucket = (typeof PHOTO_BUCKETS)[keyof typeof PHOTO_BUCKETS];

/**
 * Short TTL for on-demand receipt signed URLs (KTD-2: 60–300s, minted per view).
 * 120s comfortably covers a gallery render without leaving a long-lived link.
 */
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 120 as const;

/** Minimal shape a photo row must expose for bucket-dispatched resolution. */
export interface PhotoStorageRow {
  storage_path: string;
  bucket?: string | null;
  user_id?: string | null;
}

/** Normalizes the nullable `bucket` column to a known bucket (legacy default). */
export function photoBucketOf(bucket: string | null | undefined): PhotoBucket {
  return bucket === PHOTO_BUCKETS.RECEIPTS
    ? PHOTO_BUCKETS.RECEIPTS
    : PHOTO_BUCKETS.MAINTENANCE_PHOTOS;
}

/** True when the first path segment (the `{uid}/` folder) equals the caller. */
function pathBelongsToUser(storagePath: string, ownerUserId: string): boolean {
  return storagePath.split('/')[0] === ownerUserId;
}

/**
 * Resolves a per-photo access URL, dispatched on the row's `bucket` (U7a / R5).
 *
 * - `maintenance-photos` (legacy/default): the historical public URL, byte for
 *   byte unchanged.
 * - `receipts` (private): a short-TTL signed URL minted via the ADMIN client —
 *   but ONLY after asserting the object's folder segment equals `ownerUserId`.
 *   The admin client BYPASSES storage RLS, so this app-layer ownership check is
 *   the only C1 guard (KTD-2). A foreign-uid path (or a signing failure) yields
 *   `null` — the caller must not surface a URL it could not authorize.
 */
export async function resolvePhotoUrl(params: {
  row: PhotoStorageRow;
  ownerUserId: string;
  adminClient: SupabaseClient;
  supabaseUrl: string;
  logger?: Logger;
}): Promise<string | null> {
  const { row, ownerUserId, adminClient, supabaseUrl, logger } = params;
  const path = row.storage_path;
  const bucket = photoBucketOf(row.bucket);

  if (bucket === PHOTO_BUCKETS.MAINTENANCE_PHOTOS) {
    return `${supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKETS.MAINTENANCE_PHOTOS}/${path}`;
  }

  // receipts bucket — C1 ownership assertion (KTD-2) before any admin-signed URL.
  if (!pathBelongsToUser(path, ownerUserId)) {
    logger?.warn(
      `resolvePhotoUrl: refused signed URL for foreign-uid receipts path (owner=${ownerUserId})`,
    );
    return null;
  }

  const { data, error } = await adminClient.storage
    .from(PHOTO_BUCKETS.RECEIPTS)
    .createSignedUrl(path, RECEIPT_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    logger?.warn(`resolvePhotoUrl: failed to sign receipts object: ${error?.message}`);
    return null;
  }
  return data.signedUrl;
}

/**
 * Deletes the storage OBJECTS for a set of receipts-bucket photo rows (R5 / R10:
 * per-record object deletion). Legacy `maintenance-photos` rows are ignored here
 * — the private receipt objects are the PII-dense ones a record delete must
 * purge. Each path is re-checked against `ownerUserId` (defense-in-depth: the
 * admin client bypasses storage RLS). Best-effort: logs, never throws — a link
 * row already removed must not fail the record delete.
 */
export async function deleteReceiptsPhotoObjects(params: {
  rows: PhotoStorageRow[];
  ownerUserId: string;
  adminClient: SupabaseClient;
  logger?: Logger;
}): Promise<void> {
  const { rows, ownerUserId, adminClient, logger } = params;

  const paths = rows
    .filter((row) => photoBucketOf(row.bucket) === PHOTO_BUCKETS.RECEIPTS)
    .map((row) => row.storage_path)
    .filter((path) => pathBelongsToUser(path, ownerUserId));

  if (paths.length === 0) return;

  const { error } = await adminClient.storage.from(PHOTO_BUCKETS.RECEIPTS).remove(paths);
  if (error) {
    logger?.warn(`deleteReceiptsPhotoObjects: storage remove failed: ${error.message}`);
  }
}
