import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsService } from './documents.service';

const USER = 'user-1';
const BIKE = 'bike-1';
const DOC = 'doc-1';
const PREFIX = `${USER}/${BIKE}/${DOC}/`;

function validFiles() {
  return [{ storagePath: `${PREFIX}front.pdf`, fileSizeBytes: 1000, mimeType: 'application/pdf' }];
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    documentId: DOC,
    motorcycleId: BIKE,
    categoryId: 'cat-1',
    title: 'Policy',
    files: validFiles(),
    ...overrides,
  };
}

/**
 * Chainable Supabase mock. Builder methods return the chain; `.single()` resolves
 * per-call via mockResolvedValueOnce; a direct `await chain` consumes the FIFO
 * `awaitResults` queue (used by enforceQuota + the files insert).
 */
function createSupabaseMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    awaitResults: Array<{ data: unknown; error: unknown }>;
    then?: unknown;
  } = { awaitResults: [] } as never;

  for (const m of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'is',
    'in',
    'not',
    'lte',
    'order',
    'upsert',
  ]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn();
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable so `await chain` resolves a queued result
  chain.then = (onFulfilled: (v: unknown) => unknown) => {
    const next = chain.awaitResults.shift() ?? { data: [], error: null };
    return Promise.resolve(next).then(onFulfilled);
  };

  const createSignedUrl = vi.fn();
  const remove = vi.fn().mockResolvedValue({ error: null });
  const storageFrom = vi.fn().mockReturnValue({ createSignedUrl, remove });

  // enforceQuota uses the document_vault_bytes_used RPC; default to an empty vault.
  const rpc = vi.fn().mockResolvedValue({ data: 0, error: null });

  const from = vi.fn().mockReturnValue(chain);
  return { from, chain, rpc, storage: { from: storageFrom }, createSignedUrl, remove };
}

function makeService() {
  const user = createSupabaseMock();
  const admin = createSupabaseMock();
  // biome-ignore lint/suspicious/noExplicitAny: test mock instantiation
  const service = new (DocumentsService as any)(user, admin);
  // biome-ignore lint/suspicious/noExplicitAny: silence logger
  (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { service, user, admin };
}

describe('DocumentsService.create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an unsupported MIME type (R3) before any DB work', async () => {
    const { service, user } = makeService();
    const input = baseInput({
      files: [{ storagePath: `${PREFIX}x.html`, fileSizeBytes: 10, mimeType: 'text/html' }],
    });
    await expect(service.create(USER, input)).rejects.toThrow(BadRequestException);
    expect(user.from).not.toHaveBeenCalled();
  });

  it('rejects an oversized file (R3)', async () => {
    const { service } = makeService();
    const input = baseInput({
      files: [
        {
          storagePath: `${PREFIX}big.pdf`,
          fileSizeBytes: 999_999_999,
          mimeType: 'application/pdf',
        },
      ],
    });
    await expect(service.create(USER, input)).rejects.toThrow(BadRequestException);
  });

  it('rejects a storage path outside the {userId}/{bikeId}/{docId}/ prefix and cleans up (R17)', async () => {
    const { service, admin } = makeService();
    const input = baseInput({
      files: [
        {
          storagePath: 'other-user/bike/doc/f.pdf',
          fileSizeBytes: 10,
          mimeType: 'application/pdf',
        },
      ],
    });
    await expect(service.create(USER, input)).rejects.toThrow('Invalid storage path');
    expect(admin.remove).toHaveBeenCalled();
  });

  it('rejects a non-owned bike (R15)', async () => {
    const { service, user } = makeService();
    user.chain.single.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } }); // bike lookup
    await expect(service.create(USER, baseInput())).rejects.toThrow(ForbiddenException);
  });

  it('over-quota create rejects AND removes the uploaded objects (R21)', async () => {
    const { service, user, admin } = makeService();
    user.chain.single
      .mockResolvedValueOnce({ data: { id: BIKE }, error: null }) // bike owned
      .mockResolvedValueOnce({ data: { id: 'cat-1' }, error: null }); // category owned
    // enforceQuota RPC → existing usage already at the cap
    user.rpc.mockResolvedValueOnce({ data: 999_999_999, error: null });
    await expect(service.create(USER, baseInput())).rejects.toThrow('Vault storage limit reached');
    expect(admin.remove).toHaveBeenCalled();
  });
});

describe('DocumentsService.getSignedUrl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mints a short-TTL URL via the user client (R16)', async () => {
    const { service, user, admin } = makeService();
    user.chain.single.mockResolvedValueOnce({
      data: { storage_path: `${USER}/b/d/f.pdf`, user_id: USER },
      error: null,
    });
    user.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://signed' },
      error: null,
    });
    await expect(service.getSignedUrl(USER, 'file-1', false)).resolves.toBe('https://signed');
    expect(admin.createSignedUrl).not.toHaveBeenCalled();
  });

  it('rejects a file whose path is outside the user prefix without signing (R16)', async () => {
    const { service, user } = makeService();
    user.chain.single.mockResolvedValueOnce({
      data: { storage_path: 'someone-else/b/d/f.pdf', user_id: 'someone-else' },
      error: null,
    });
    await expect(service.getSignedUrl(USER, 'file-1', false)).rejects.toThrow(NotFoundException);
    expect(user.createSignedUrl).not.toHaveBeenCalled();
  });

  it('falls back to the admin client when user-client signing is blocked', async () => {
    const { service, user, admin } = makeService();
    user.chain.single.mockResolvedValueOnce({
      data: { storage_path: `${USER}/b/d/f.pdf`, user_id: USER },
      error: null,
    });
    user.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'rls blocked' } });
    admin.createSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: 'https://admin' },
      error: null,
    });
    await expect(service.getSignedUrl(USER, 'file-1', false)).resolves.toBe('https://admin');
  });
});

describe('DocumentsService.delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes the row before the storage objects (row-first, R19)', async () => {
    // Row-first ordering is the correctness guarantee: a failed storage removal
    // after the row is gone leaves only reclaimable orphans (object-without-row),
    // never an unreclaimable phantom (row-without-object).
    const { service, user, admin } = makeService();
    const order: string[] = [];
    user.chain.single.mockResolvedValueOnce({ data: { id: DOC }, error: null }); // ownership
    // file-paths read (awaited chain)
    user.chain.awaitResults.push({ data: [{ storage_path: `${USER}/b/d/f.pdf` }], error: null });
    user.chain.delete.mockImplementationOnce(() => {
      order.push('row');
      return user.chain;
    });
    // the row delete is awaited via .eq → push a result for that await
    user.chain.awaitResults.push({ data: null, error: null });
    admin.remove.mockImplementationOnce(async () => {
      order.push('storage');
      return { error: null };
    });
    await service.delete(USER, DOC);
    expect(order).toEqual(['row', 'storage']);
  });

  it('still succeeds when storage removal fails after the row is deleted (orphan sweep reclaims)', async () => {
    const { service, user, admin } = makeService();
    user.chain.single.mockResolvedValueOnce({ data: { id: DOC }, error: null }); // ownership
    user.chain.awaitResults.push({ data: [{ storage_path: `${USER}/b/d/f.pdf` }], error: null });
    user.chain.awaitResults.push({ data: null, error: null }); // row delete succeeds
    admin.remove.mockResolvedValueOnce({ error: { message: 'bucket unavailable' } });
    await expect(service.delete(USER, DOC)).resolves.toBe(true);
    expect(admin.remove).toHaveBeenCalled();
  });

  it('throws and leaves storage untouched when the row delete fails (fully retryable)', async () => {
    const { service, user, admin } = makeService();
    user.chain.single.mockResolvedValueOnce({ data: { id: DOC }, error: null }); // ownership
    user.chain.awaitResults.push({ data: [{ storage_path: `${USER}/b/d/f.pdf` }], error: null });
    user.chain.awaitResults.push({ data: null, error: { message: 'row delete failed' } });
    await expect(service.delete(USER, DOC)).rejects.toThrow(InternalServerErrorException);
    expect(admin.remove).not.toHaveBeenCalled();
  });
});
