// Photo uploads into shared folders (a task's, a note's, an expense's). Photos of
// one save upload side by side; with a timestamp-only name two of them in the
// same millisecond collided and the second `upsert: false` upload failed. Also
// covers the upload deadline that keeps a stalled upload from holding a sheet.

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn((path: string) => ({
  data: { publicUrl: `https://cdn.example/${path}` },
}));
const mockFrom = jest.fn((_bucket: string) => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));
jest.mock('../supabase', () => ({
  supabase: { storage: { from: (bucket: string) => mockFrom(bucket) } },
}));

const mockRandomUUID = jest.fn<string, []>();
jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

const mockBytes = new Uint8Array([1, 2, 3, 4]);
jest.mock('expo-file-system', () => ({
  File: class {
    bytes() {
      return Promise.resolve(mockBytes);
    }
  },
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { WEBP: 'webp' },
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file:///compressed.webp' }),
}));

jest.mock('expo-image-picker', () => ({}));

import {
  STORAGE_UPLOAD_TIMEOUT_MS,
  StorageUploadTimeoutError,
  uniquePhotoName,
  uploadBikePhoto,
  uploadExpensePhoto,
  uploadMaintenancePhoto,
  uploadNotePhoto,
  uploadReceiptPhoto,
} from '../image-upload';
import { isNetworkError } from '../network-error';

const NOW = 1_760_000_000_000;
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'user-1';
const MAINTENANCE_BUCKET = 'maintenance-photos';

let dateNowSpy: jest.SpyInstance<number, []>;

beforeEach(() => {
  mockUpload.mockReset().mockResolvedValue({ data: {}, error: null });
  mockFrom.mockClear();
  mockRandomUUID.mockReset().mockReturnValueOnce(UUID_A).mockReturnValueOnce(UUID_B);
  dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  dateNowSpy.mockRestore();
  jest.useRealTimers();
});

function uploadedPath(call = 0): string {
  return mockUpload.mock.calls[call][0] as string;
}

describe('uniquePhotoName', () => {
  it('gives two photos named in the same millisecond distinct <ts>-<uuid>.webp names', () => {
    const first = uniquePhotoName();
    const second = uniquePhotoName();

    expect(first).toBe(`${NOW}-${UUID_A}.webp`);
    expect(second).toBe(`${NOW}-${UUID_B}.webp`);
    expect(first).not.toBe(second);
  });
});

describe.each([
  ['uploadMaintenancePhoto', uploadMaintenancePhoto, `${USER_ID}/task-1/`, 'task-1'],
  ['uploadNotePhoto', uploadNotePhoto, `${USER_ID}/notes/note-1/`, 'note-1'],
  ['uploadExpensePhoto', uploadExpensePhoto, `${USER_ID}/expenses/expense-1/`, 'expense-1'],
] as const)('%s', (_name, upload, prefix, ownerId) => {
  it('uploads under the owner prefix with a unique photo name and no upsert', async () => {
    const result = await upload('file:///photo.jpg', USER_ID, ownerId);

    expect(mockFrom).toHaveBeenCalledWith(MAINTENANCE_BUCKET);
    const path = uploadedPath();
    expect(path).toBe(`${prefix}${NOW}-${UUID_A}.webp`);
    expect(mockUpload).toHaveBeenCalledWith(path, mockBytes, {
      contentType: 'image/webp',
      upsert: false,
    });
    expect(result).toEqual({ storagePath: path, fileSizeBytes: mockBytes.byteLength });
  });

  it('names two photos of one save differently', async () => {
    await upload('file:///a.jpg', USER_ID, ownerId);
    await upload('file:///b.jpg', USER_ID, ownerId);

    expect(uploadedPath(0)).toBe(`${prefix}${NOW}-${UUID_A}.webp`);
    expect(uploadedPath(1)).toBe(`${prefix}${NOW}-${UUID_B}.webp`);
  });

  it('rethrows a Storage error', async () => {
    const storageError = new Error('The resource already exists');
    mockUpload.mockResolvedValue({ data: null, error: storageError });

    await expect(upload('file:///photo.jpg', USER_ID, ownerId)).rejects.toBe(storageError);
  });
});

describe('upload deadline', () => {
  it('rejects with a recognisable timeout when the upload never settles', async () => {
    jest.useFakeTimers();
    mockUpload.mockReturnValue(new Promise(() => {}));

    const pending = uploadNotePhoto('file:///photo.jpg', USER_ID, 'note-1');
    const settled = pending.catch((e: unknown) => e);
    // Let the compress + byte read resolve so the upload (and its timer) starts.
    await jest.advanceTimersByTimeAsync(STORAGE_UPLOAD_TIMEOUT_MS - 1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);

    const error = await settled;
    expect(error).toBeInstanceOf(StorageUploadTimeoutError);
    expect(isNetworkError(error)).toBe(true);
  });

  it('does not fire once the upload has settled', async () => {
    jest.useFakeTimers();

    await expect(uploadNotePhoto('file:///photo.jpg', USER_ID, 'note-1')).resolves.toEqual(
      expect.objectContaining({ fileSizeBytes: mockBytes.byteLength }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });
});

// The fixed-path uploads (bike hero, receipt) overwrite with `upsert: true` and
// go through the same deadline as the shared-folder photos.
describe.each([
  [
    'uploadBikePhoto',
    () => uploadBikePhoto('file:///hero.jpg', USER_ID, 'bike-1'),
    'bike-photos',
    `${USER_ID}/bike-1/hero.webp`,
  ],
  [
    'uploadBikePhoto (onboarding)',
    () => uploadBikePhoto('file:///hero.jpg', USER_ID),
    'bike-photos',
    `${USER_ID}/onboarding/hero.webp`,
  ],
  [
    'uploadReceiptPhoto',
    () => uploadReceiptPhoto('file:///receipt.jpg', USER_ID, 'scan-1'),
    'receipts',
    `${USER_ID}/scan-1.webp`,
  ],
] as const)('%s', (_name, upload, bucket, path) => {
  it('uploads to its fixed path with upsert', async () => {
    await upload();

    expect(mockFrom).toHaveBeenCalledWith(bucket);
    expect(mockUpload).toHaveBeenCalledWith(path, mockBytes, {
      contentType: 'image/webp',
      upsert: true,
    });
  });

  it('rejects with the upload timeout when the upload never settles', async () => {
    jest.useFakeTimers();
    mockUpload.mockReturnValue(new Promise(() => {}));

    const settled = upload().catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(STORAGE_UPLOAD_TIMEOUT_MS);

    const error = await settled;
    expect(error).toBeInstanceOf(StorageUploadTimeoutError);
    expect((error as Error).message).toContain(bucket);
  });

  it('rethrows a Storage error', async () => {
    const storageError = new Error('Payload too large');
    mockUpload.mockResolvedValue({ data: null, error: storageError });

    await expect(upload()).rejects.toBe(storageError);
  });
});

describe('StorageUploadTimeoutError', () => {
  it('is classified as a transient network error by message alone', () => {
    expect(
      isNetworkError(new StorageUploadTimeoutError('receipts', STORAGE_UPLOAD_TIMEOUT_MS)),
    ).toBe(true);
  });
});
