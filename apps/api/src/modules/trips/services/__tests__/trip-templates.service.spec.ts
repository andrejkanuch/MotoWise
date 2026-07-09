import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevalidationService } from '../../../../common/revalidation/revalidation.service';
import { TripTemplatesService } from '../trip-templates.service';

/**
 * A chainable, thenable Supabase query stub. Every builder method returns the
 * same object so the service can keep chaining filters; `then` resolves with the
 * next queued result each time it is awaited. This lets us simulate a transient
 * error on the first execution followed by success on the retry.
 */
function makeQueryStub(results: Array<{ data: unknown; error: unknown }>) {
  let call = 0;
  const stub: Record<string, unknown> = {};
  const chain = () => stub;
  for (const method of [
    'select',
    'eq',
    'ilike',
    'order',
    'limit',
    'gte',
    'lte',
    'textSearch',
    'or',
  ]) {
    stub[method] = vi.fn(chain);
  }
  // PostgrestBuilder is thenable; re-awaiting runs the query again. The stub must
  // mirror that, so a `then` property is intentional here.
  // biome-ignore lint/suspicious/noThenProperty: mocking PostgREST's thenable builder
  stub.then = (
    resolve: (value: { data: unknown; error: unknown }) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => {
    const result = results[Math.min(call, results.length - 1)];
    call += 1;
    return Promise.resolve(result).then(resolve, reject);
  };
  return { stub, executions: () => call };
}

const aRow = {
  id: 'trip-1',
  published_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  title: 'Pacific Coast Highway',
  is_template: true,
  is_flagged: false,
};

describe('TripTemplatesService.listTemplates', () => {
  let service: TripTemplatesService;
  let supabaseAdmin: { from: ReturnType<typeof vi.fn> };
  let queryStub: ReturnType<typeof makeQueryStub>;

  const buildService = (results: Array<{ data: unknown; error: unknown }>) => {
    queryStub = makeQueryStub(results);
    supabaseAdmin = { from: vi.fn(() => queryStub.stub) };
    service = new TripTemplatesService(
      {} as unknown as SupabaseClient,
      supabaseAdmin as unknown as SupabaseClient,
      { revalidate: vi.fn() } as unknown as RevalidationService,
    );
    // Silence the expected error log on permanent failures.
    // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
    vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('retries once on a transient Supabase error and returns the rows', async () => {
    buildService([
      { data: null, error: { message: 'timeout', code: '57014' } },
      { data: [aRow], error: null },
    ]);

    const promise = service.listTemplates(undefined, 10);
    await vi.runAllTimersAsync();
    const connection = await promise;

    expect(queryStub.executions()).toBe(2);
    expect(connection.edges).toHaveLength(1);
    expect(connection.edges[0]?.node.id).toBe('trip-1');
  });

  it('throws InternalServerErrorException when the retry also fails', async () => {
    buildService([
      { data: null, error: { message: 'timeout', code: '57014' } },
      { data: null, error: { message: 'timeout', code: '57014' } },
    ]);

    const promise = service.listTemplates(undefined, 10);
    const assertion = expect(promise).rejects.toThrow('Failed to fetch templates');
    await vi.runAllTimersAsync();
    await assertion;

    expect(queryStub.executions()).toBe(2);
  });

  it('does not retry when the first attempt succeeds', async () => {
    buildService([{ data: [aRow], error: null }]);

    const connection = await service.listTemplates(undefined, 10);

    expect(queryStub.executions()).toBe(1);
    expect(connection.edges).toHaveLength(1);
  });

  it('applies the region filter as case-insensitive equality on region_code', async () => {
    buildService([{ data: [aRow], error: null }]);

    await service.listTemplates({ country: 'jp', region: 'JP-03' }, 10);

    expect(queryStub.stub.eq).toHaveBeenCalledWith('country_code', 'JP');
    expect(queryStub.stub.ilike).toHaveBeenCalledWith('region_code', 'jp-03');
  });

  it('escapes LIKE metacharacters in the region filter (no wildcard matching)', async () => {
    buildService([{ data: [], error: null }]);

    await service.listTemplates({ country: 'jp', region: 'jp_0%' }, 10);

    // "_" and "%" must be escaped so /explore/jp/jp_03 cannot pattern-match
    // 'JP-03' and mint duplicate-content pages.
    expect(queryStub.stub.ilike).toHaveBeenCalledWith('region_code', 'jp\\_0\\%');
  });

  it('does not apply a region_code filter when the filter has no region', async () => {
    buildService([{ data: [aRow], error: null }]);

    await service.listTemplates({ country: 'jp' }, 10);

    expect(queryStub.stub.ilike).not.toHaveBeenCalled();
  });
});
