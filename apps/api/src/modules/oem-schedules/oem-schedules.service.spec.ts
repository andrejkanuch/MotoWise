import { ForbiddenException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { OemSchedulesService } from './oem-schedules.service';

type QueryResult = { data: unknown; error: unknown };

interface RecordedQuery {
  table: string;
  filters: Array<{ column: string; value: unknown }>;
  updatePayload?: unknown;
}

/**
 * Minimal chainable Supabase mock. Records the table + every `.eq/.is/.in/.not` filter and any
 * `.update` payload, then resolves chains terminating in `.order`, `.single`, or `await`.
 */
function createMockSupabase(resultFor: (q: RecordedQuery) => QueryResult) {
  const queries: RecordedQuery[] = [];

  function makeBuilder(table: string) {
    const record: RecordedQuery = { table, filters: [] };
    queries.push(record);
    const result = (): QueryResult => resultFor(record);

    const builder = {
      select: () => builder,
      update: (payload: unknown) => {
        record.updatePayload = payload;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        record.filters.push({ column, value });
        return builder;
      },
      is: (column: string, value: unknown) => {
        record.filters.push({ column, value });
        return builder;
      },
      not: (column: string, _op: string, value: unknown) => {
        record.filters.push({ column, value });
        return builder;
      },
      in: (column: string, value: unknown) => {
        record.filters.push({ column, value });
        return builder;
      },
      or: () => builder,
      order: () => Promise.resolve(result()),
      single: () => Promise.resolve(result()),
      // biome-ignore lint/suspicious/noThenProperty: chainable Supabase mock must be awaitable
      then: (onFulfilled: (r: QueryResult) => unknown) =>
        Promise.resolve(result()).then(onFulfilled),
    };
    return builder;
  }

  const client = { from: (table: string) => makeBuilder(table) } as unknown as SupabaseClient;
  return { client, queries };
}

const GATE = { column: 'is_verified', value: true };

describe('OemSchedulesService — verification gate', () => {
  let queries: RecordedQuery[];

  function serviceWith(resultFor: (q: RecordedQuery) => QueryResult) {
    const mock = createMockSupabase(resultFor);
    queries = mock.queries;
    return new OemSchedulesService(mock.client);
  }

  beforeEach(() => {
    queries = [];
  });

  it('applies is_verified=true on EVERY findByMotorcycle tier (drafts excluded everywhere)', async () => {
    // All tiers empty → the waterfall falls through all four, exercising each query path.
    const service = serviceWith(() => ({ data: [], error: null }));
    await service.findByMotorcycle('HONDA', 'CRF1100', 2022, null, 'DCT');

    const scheduleQueries = queries.filter((q) => q.table === 'oem_maintenance_schedules');
    expect(scheduleQueries.length).toBeGreaterThanOrEqual(4);
    for (const q of scheduleQueries) {
      expect(q.filters).toContainEqual(GATE);
    }
  });

  it('queries the variant tier first when a variant is supplied', async () => {
    const service = serviceWith(() => ({ data: [], error: null }));
    await service.findByMotorcycle('HONDA', 'CRF1100', null, null, 'DCT');

    const first = queries.find((q) => q.table === 'oem_maintenance_schedules');
    expect(first?.filters).toContainEqual({ column: 'variant', value: 'DCT' });
    expect(first?.filters).toContainEqual(GATE);
  });

  it('gates the scheduleIdFilter PK branch so an unverified draft id cannot be imported', async () => {
    // The gate filters the draft out → empty result → zero tasks inserted.
    const service = serviceWith(() => ({ data: [], error: null }));
    const count = await service.autoPopulateForBike(
      {} as unknown as SupabaseClient,
      'user-1',
      'moto-1',
      'HONDA',
      'CRF1100',
      2022,
      null,
      0,
      ['draft-id'],
      'DCT',
    );

    expect(count).toBe(0);
    const pkQuery = queries.find(
      (q) => q.table === 'oem_maintenance_schedules' && q.filters.some((f) => f.column === 'id'),
    );
    expect(pkQuery).toBeDefined();
    expect(pkQuery?.filters).toContainEqual(GATE);
  });
});

describe('OemSchedulesService — admin approval', () => {
  function serviceWith(resultFor: (q: RecordedQuery) => QueryResult) {
    return createMockSupabase(resultFor);
  }

  it('rejects a non-admin from approving a draft', async () => {
    const { client } = serviceWith((q) =>
      q.table === 'users' ? { data: { role: 'user' }, error: null } : { data: null, error: null },
    );
    const service = new OemSchedulesService(client);

    await expect(
      service.approveMaintenanceDraft('user-1', { kind: 'schedule', id: 'd1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('approves a draft as admin and stamps is_verified + verified_by', async () => {
    const { client, queries } = serviceWith((q) => {
      if (q.table === 'users') return { data: { role: 'admin' }, error: null };
      if (q.table === 'oem_maintenance_schedules') return { data: { id: 'd1' }, error: null };
      return { data: null, error: null };
    });
    const service = new OemSchedulesService(client);

    const ok = await service.approveMaintenanceDraft('admin-1', { kind: 'schedule', id: 'd1' });
    expect(ok).toBe(true);

    const update = queries.find(
      (q) => q.table === 'oem_maintenance_schedules' && q.updatePayload != null,
    );
    expect(update?.updatePayload).toMatchObject({ is_verified: true, verified_by: 'admin-1' });
  });

  it('routes spec approvals to the motorcycle_specs table', async () => {
    const { client, queries } = serviceWith((q) => {
      if (q.table === 'users') return { data: { role: 'admin' }, error: null };
      if (q.table === 'motorcycle_specs') return { data: { id: 's1' }, error: null };
      return { data: null, error: null };
    });
    const service = new OemSchedulesService(client);

    await service.approveMaintenanceDraft('admin-1', { kind: 'spec', id: 's1' });
    expect(queries.some((q) => q.table === 'motorcycle_specs' && q.updatePayload != null)).toBe(
      true,
    );
  });
});
