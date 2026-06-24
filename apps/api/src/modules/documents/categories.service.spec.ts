import { SEEDED_CATEGORIES } from '@motovault/types';
import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PG_ERROR } from '../../common/supabase/unwrap';
import { DocumentCategoriesService } from './categories.service';

const USER = 'user-1';

/**
 * Chainable Supabase mock. Builder methods return the chain; `.single()` resolves
 * per-call via mockResolvedValueOnce; awaiting the chain (count head query, upsert,
 * fetch) consumes the FIFO `awaitResults` queue.
 */
function createSupabaseMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> & {
    awaitResults: Array<{ data?: unknown; error: unknown; count?: number | null }>;
    then?: unknown;
  } = { awaitResults: [] } as never;

  for (const m of ['select', 'insert', 'update', 'upsert', 'eq', 'order']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.single = vi.fn();
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable so `await chain` resolves a queued result
  chain.then = (onFulfilled: (v: unknown) => unknown) => {
    const next = chain.awaitResults.shift() ?? { data: [], error: null };
    return Promise.resolve(next).then(onFulfilled);
  };
  const from = vi.fn().mockReturnValue(chain);
  return { from, chain };
}

function makeService() {
  const supabase = createSupabaseMock();
  // biome-ignore lint/suspicious/noExplicitAny: test mock instantiation
  const service = new (DocumentCategoriesService as any)(supabase);
  // biome-ignore lint/suspicious/noExplicitAny: silence logger
  (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { service, supabase };
}

describe('DocumentCategoriesService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seeds the default set on first vault access, then returns the fetched rows', async () => {
    const { service, supabase } = makeService();
    supabase.chain.awaitResults.push(
      { count: 0, error: null }, // empty vault
      { error: null }, // seed upsert
      { data: [{ id: 'c1', name: 'Insurance', kind: 'seeded' }], error: null }, // fetch
    );
    const result = await service.list(USER);
    expect(supabase.chain.upsert).toHaveBeenCalledTimes(1);
    // Seeds every canonical category name.
    const seeded = supabase.chain.upsert.mock.calls[0][0] as Array<{ name: string }>;
    expect(seeded).toHaveLength(SEEDED_CATEGORIES.length);
    expect(result).toHaveLength(1);
  });

  it('does NOT seed when the vault already has categories', async () => {
    const { service, supabase } = makeService();
    supabase.chain.awaitResults.push(
      { count: 8, error: null }, // already seeded
      { data: [], error: null }, // fetch
    );
    await service.list(USER);
    expect(supabase.chain.upsert).not.toHaveBeenCalled();
  });

  it('does NOT seed when the count query errors (no false "empty vault")', async () => {
    const { service, supabase } = makeService();
    supabase.chain.awaitResults.push(
      { count: null, error: { message: 'db down' } }, // count failed
      { data: [], error: null }, // fetch
    );
    await service.list(USER);
    expect(supabase.chain.upsert).not.toHaveBeenCalled();
  });
});

describe('DocumentCategoriesService.add', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a custom category', async () => {
    const { service, supabase } = makeService();
    supabase.chain.single.mockResolvedValueOnce({
      data: { id: 'c2', name: 'Toll Tags', kind: 'custom', is_hidden: false },
      error: null,
    });
    const result = await service.add(USER, { name: 'Toll Tags' });
    expect(result.name).toBe('Toll Tags');
  });

  it('unhides an existing hidden category when its name is re-added (R7)', async () => {
    const { service, supabase } = makeService();
    supabase.chain.single
      .mockResolvedValueOnce({ data: null, error: { code: PG_ERROR.UNIQUE_VIOLATION } }) // insert collides
      .mockResolvedValueOnce({
        data: { id: 'c1', name: 'Insurance', is_hidden: true },
        error: null,
      }) // lookup
      .mockResolvedValueOnce({
        data: { id: 'c1', name: 'Insurance', is_hidden: false },
        error: null,
      }); // unhide
    const result = await service.add(USER, { name: 'Insurance' });
    expect(result.isHidden).toBe(false);
    expect(supabase.chain.update).toHaveBeenCalledWith({ is_hidden: false });
  });

  it('errors on a duplicate name that is already visible', async () => {
    const { service, supabase } = makeService();
    supabase.chain.single
      .mockResolvedValueOnce({ data: null, error: { code: PG_ERROR.UNIQUE_VIOLATION } }) // insert collides
      .mockResolvedValueOnce({
        data: { id: 'c1', name: 'Insurance', is_hidden: false },
        error: null,
      }); // lookup → already visible
    await expect(service.add(USER, { name: 'Insurance' })).rejects.toThrow(BadRequestException);
    expect(supabase.chain.update).not.toHaveBeenCalled();
  });
});

describe('DocumentCategoriesService.update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an empty patch without touching the DB', async () => {
    const { service, supabase } = makeService();
    await expect(service.update(USER, 'c1', {})).rejects.toThrow(BadRequestException);
    expect(supabase.chain.update).not.toHaveBeenCalled();
  });

  it('hides a category (is_hidden only — documents untouched)', async () => {
    const { service, supabase } = makeService();
    supabase.chain.single.mockResolvedValueOnce({
      data: { id: 'c1', name: 'Insurance', is_hidden: true },
      error: null,
    });
    const result = await service.update(USER, 'c1', { isHidden: true });
    expect(supabase.chain.update).toHaveBeenCalledWith({ is_hidden: true });
    expect(result.isHidden).toBe(true);
  });
});
