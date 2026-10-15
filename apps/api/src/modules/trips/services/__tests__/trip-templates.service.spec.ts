import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevalidationService } from '../../../../common/revalidation/revalidation.service';
import { RIDE_ALREADY_SHARED_MESSAGE } from '../../errors/trip-db.errors';
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

/**
 * publishAsTemplate on a trip whose source ride already has a template (it was
 * unpublished, the ride re-shared, then this one republished) loses to 00192's
 * one-template-per-ride index.
 */
describe('TripTemplatesService.publishAsTemplate', () => {
  type Result = { data: unknown; error: unknown };

  /** One stub per `.from()` call, each resolving its own queued result. */
  const buildService = (results: Result[]) => {
    let next = 0;
    const from = vi.fn(() => {
      const result = results[Math.min(next++, results.length - 1)] as Result;
      const stub: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'order', 'update']) stub[method] = vi.fn(() => stub);
      stub.single = vi.fn(() => Promise.resolve(result));
      // biome-ignore lint/suspicious/noThenProperty: mocking PostgREST's thenable builder
      stub.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
      return stub;
    });
    const service = new TripTemplatesService(
      { from } as unknown as SupabaseClient,
      {} as unknown as SupabaseClient,
      { revalidate: vi.fn() } as unknown as RevalidationService,
    );
    // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
    vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    return service;
  };

  const ownedDraft = {
    data: {
      id: 'trip-1',
      title: 'Evening loop',
      description: 'Shared from a ride',
      organiser_user_id: 'user-1',
      country_code: 'SK',
      is_template: false,
    },
    error: null,
  };
  const twoWaypoints = {
    data: [
      { id: 'w1', sort_order: 0, day_index: 0, type: 'start', name: 'A', lat: 48.1, lng: 17.1 },
      { id: 'w2', sort_order: 1, day_index: 0, type: 'end', name: 'B', lat: 48.2, lng: 17.2 },
    ],
    error: null,
  };
  const uniqueViolation = (index: string) => ({
    data: null,
    error: {
      code: '23505',
      message: `duplicate key value violates unique constraint "${index}"`,
    } as PostgrestError,
  });

  const publish = (update: Result) =>
    buildService([ownedDraft, twoWaypoints, update])
      .publishAsTemplate('user-1', 'trip-1')
      .then(() => null)
      .catch((e: unknown) => e);

  it('answers "already shared" when the ride already has a template', async () => {
    const thrown = await publish(uniqueViolation('idx_trips_one_template_per_source_ride'));

    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as Error).message).toBe(RIDE_ALREADY_SHARED_MESSAGE);
  });

  it('keeps a slug clash a generic publish failure', async () => {
    const thrown = await publish(uniqueViolation('idx_trips_template_slug'));

    expect(thrown).toBeInstanceOf(InternalServerErrorException);
  });
});
