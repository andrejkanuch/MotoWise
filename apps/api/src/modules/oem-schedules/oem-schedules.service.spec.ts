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

  it('queries the variant-specific rows (gated) when a variant is supplied', async () => {
    const service = serviceWith(() => ({ data: [], error: null }));
    await service.findByMotorcycle('HONDA', 'CRF1100', null, null, 'DCT');

    const variantQuery = queries.find(
      (q) =>
        q.table === 'oem_maintenance_schedules' &&
        q.filters.some((f) => f.column === 'variant' && f.value === 'DCT'),
    );
    expect(variantQuery).toBeDefined();
    expect(variantQuery?.filters).toContainEqual(GATE);
  });

  it('merges variant-specific rows over the variant-null baseline (variant wins, baseline kept)', async () => {
    // Baseline (variant IS NULL) has oil + chain; the DCT variant overrides "oil change" and
    // adds a DCT-only task. A DCT bike must get the DCT oil row + the DCT task + the baseline
    // chain row (audit P2: a variant hit must not hide baseline tasks).
    const service = serviceWith((q) => {
      if (q.table !== 'oem_maintenance_schedules') return { data: [], error: null };
      const isVariant = q.filters.some((f) => f.column === 'variant' && f.value === 'DCT');
      if (isVariant) {
        return {
          data: [
            { id: 'v1', make: 'HONDA', task_name: 'Oil change', sort_order: 1, priority: 'high' },
            { id: 'v2', make: 'HONDA', task_name: 'DCT fluid', sort_order: 3, priority: 'high' },
          ],
          error: null,
        };
      }
      const isBaselineModel = q.filters.some((f) => f.column === 'variant' && f.value === null);
      if (isBaselineModel) {
        return {
          data: [
            { id: 'b1', make: 'HONDA', task_name: 'Oil change', sort_order: 1, priority: 'low' },
            { id: 'b2', make: 'HONDA', task_name: 'Chain', sort_order: 2, priority: 'medium' },
          ],
          error: null,
        };
      }
      return { data: [], error: null };
    });

    const result = await service.findByMotorcycle('HONDA', 'CRF1100', null, null, 'DCT');
    const byTask = Object.fromEntries(result.map((r) => [r.taskName, r]));
    expect(Object.keys(byTask).sort()).toEqual(['Chain', 'DCT fluid', 'Oil change']);
    expect(byTask['Oil change'].id).toBe('v1'); // variant row won the conflict
    expect(byTask.Chain.id).toBe('b2'); // baseline-only task preserved
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
