import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteReceiptsPhotoObjects,
  PHOTO_BUCKETS,
  photoBucketOf,
  RECEIPT_SIGNED_URL_TTL_SECONDS,
  resolvePhotoUrl,
} from './photo-storage';

const SUPABASE_URL = 'https://example.supabase.co';
const UID = '11111111-1111-1111-1111-111111111111';
const OTHER_UID = '22222222-2222-2222-2222-222222222222';

function createAdminMock(signResult?: { data?: unknown; error?: unknown }) {
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue(
      signResult ?? { data: { signedUrl: 'https://signed/url?token=abc' }, error: null },
    );
  const remove = vi.fn().mockResolvedValue({ error: null });
  const storageFrom = vi.fn().mockReturnValue({ createSignedUrl, remove });
  const adminClient = { storage: { from: storageFrom } } as unknown as SupabaseClient;
  return { adminClient, storageFrom, createSignedUrl, remove };
}

describe('photo-storage', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('photoBucketOf', () => {
    it('defaults null/undefined/legacy to maintenance-photos', () => {
      expect(photoBucketOf(null)).toBe(PHOTO_BUCKETS.MAINTENANCE_PHOTOS);
      expect(photoBucketOf(undefined)).toBe(PHOTO_BUCKETS.MAINTENANCE_PHOTOS);
      expect(photoBucketOf('maintenance-photos')).toBe(PHOTO_BUCKETS.MAINTENANCE_PHOTOS);
    });
    it('maps receipts to the private bucket', () => {
      expect(photoBucketOf('receipts')).toBe(PHOTO_BUCKETS.RECEIPTS);
    });
  });

  describe('resolvePhotoUrl — legacy bucket', () => {
    it('returns the historical public URL byte-identical (default bucket)', async () => {
      const { adminClient, storageFrom } = createAdminMock();
      const url = await resolvePhotoUrl({
        row: { storage_path: `${UID}/expenses/e1/photo.webp`, bucket: null },
        ownerUserId: UID,
        adminClient,
        supabaseUrl: SUPABASE_URL,
      });
      expect(url).toBe(
        `${SUPABASE_URL}/storage/v1/object/public/maintenance-photos/${UID}/expenses/e1/photo.webp`,
      );
      // No signing for public photos.
      expect(storageFrom).not.toHaveBeenCalled();
    });
  });

  describe('resolvePhotoUrl — receipts bucket', () => {
    it('mints a short-TTL signed URL via the admin client for an owned path', async () => {
      const { adminClient, storageFrom, createSignedUrl } = createAdminMock();
      const url = await resolvePhotoUrl({
        row: { storage_path: `${UID}/scan.webp`, bucket: 'receipts' },
        ownerUserId: UID,
        adminClient,
        supabaseUrl: SUPABASE_URL,
      });
      expect(url).toBe('https://signed/url?token=abc');
      expect(storageFrom).toHaveBeenCalledWith('receipts');
      expect(createSignedUrl).toHaveBeenCalledWith(
        `${UID}/scan.webp`,
        RECEIPT_SIGNED_URL_TTL_SECONDS,
      );
    });

    it('C1: refuses to sign a foreign-uid path (never calls the admin client)', async () => {
      const { adminClient, createSignedUrl } = createAdminMock();
      const url = await resolvePhotoUrl({
        row: { storage_path: `${OTHER_UID}/scan.webp`, bucket: 'receipts' },
        ownerUserId: UID,
        adminClient,
        supabaseUrl: SUPABASE_URL,
      });
      expect(url).toBeNull();
      expect(createSignedUrl).not.toHaveBeenCalled();
    });

    it('returns null when signing fails', async () => {
      const { adminClient } = createAdminMock({ data: null, error: { message: 'nope' } });
      const url = await resolvePhotoUrl({
        row: { storage_path: `${UID}/scan.webp`, bucket: 'receipts' },
        ownerUserId: UID,
        adminClient,
        supabaseUrl: SUPABASE_URL,
      });
      expect(url).toBeNull();
    });
  });

  describe('deleteReceiptsPhotoObjects', () => {
    it('removes only receipts-bucket objects owned by the user', async () => {
      const { adminClient, storageFrom, remove } = createAdminMock();
      const { removedPaths } = await deleteReceiptsPhotoObjects({
        rows: [
          { storage_path: `${UID}/a.webp`, bucket: 'receipts' },
          { storage_path: `${UID}/expenses/e1/legacy.webp`, bucket: 'maintenance-photos' },
          { storage_path: `${OTHER_UID}/foreign.webp`, bucket: 'receipts' },
        ],
        ownerUserId: UID,
        adminClient,
      });
      expect(storageFrom).toHaveBeenCalledWith('receipts');
      // Only the owned receipts object — legacy + foreign-uid filtered out.
      expect(remove).toHaveBeenCalledWith([`${UID}/a.webp`]);
      // The caller learns which objects were actually removed (drives link unlink).
      expect(removedPaths).toEqual([`${UID}/a.webp`]);
    });

    it('does nothing when there are no receipts objects', async () => {
      const { adminClient, remove } = createAdminMock();
      const { removedPaths } = await deleteReceiptsPhotoObjects({
        rows: [{ storage_path: `${UID}/expenses/e1/legacy.webp`, bucket: 'maintenance-photos' }],
        ownerUserId: UID,
        adminClient,
      });
      expect(remove).not.toHaveBeenCalled();
      expect(removedPaths).toEqual([]);
    });

    it('returns no removed paths when the storage remove fails (link retained)', async () => {
      const { adminClient, remove } = createAdminMock();
      remove.mockResolvedValueOnce({ error: { message: 'storage down' } });
      const { removedPaths } = await deleteReceiptsPhotoObjects({
        rows: [{ storage_path: `${UID}/a.webp`, bucket: 'receipts' }],
        ownerUserId: UID,
        adminClient,
      });
      expect(removedPaths).toEqual([]);
    });
  });
});
