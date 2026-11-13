import { ForbiddenException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { OemSchedulesService } from './oem-schedules.service';
import { SERVICE_PLAN_TIER } from './service-plan';

type QueryResult = { data: unknown; error: unknown };

interface RecordedQuery {
  table: string;
  filters: Array<{ column: string; value: unknown }>;
  updatePayload?: unknown;
  insertPayload?: unknown;
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
      insert: (payload: unknown) => {
        record.insertPayload = payload;
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

// #365 T07a: onboarding imports the full waterfall in the unit the rider chose.
describe('OemSchedulesService.importServicePlan', () => {
  const MODEL_ROWS = [
    {
      id: 's-oil',
      make: 'YAMAHA',
      model: 'MT-09',
      task_name: 'Oil',
      interval_km: 10_000,
      sort_order: 1,
    },
    {
      id: 's-chain',
      make: 'YAMAHA',
      model: 'MT-09',
      task_name: 'Chain',
      interval_km: 1_000,
      sort_order: 2,
    },
  ];
  const MAKE_ROWS = [{ id: 's-make', make: 'HONDA', model: null, task_name: 'Oil', sort_order: 1 }];

  function serviceWith(opts: {
    modelRows?: unknown[];
    makeRows?: unknown[];
    existing?: unknown[];
    measurementSystem?: string;
  }) {
    const mock = createMockSupabase((q) => {
      if (q.table === 'oem_maintenance_schedules') {
        const modelIsNull = q.filters.some((f) => f.column === 'model' && f.value === null);
        return { data: modelIsNull ? (opts.makeRows ?? []) : (opts.modelRows ?? []), error: null };
      }
      if (q.table === 'users') {
        return { data: { measurement_system: opts.measurementSystem ?? 'metric' }, error: null };
      }
      if (q.table === 'maintenance_tasks') return { data: opts.existing ?? [], error: null };
      return { data: null, error: null };
    });
    const user = createMockSupabase(() => ({ data: null, error: null }));
    return {
      service: new OemSchedulesService(mock.client),
      adminQueries: mock.queries,
      userClient: user.client,
      userQueries: user.queries,
    };
  }

  const bike = {
    userId: 'user-1',
    motorcycleId: 'moto-1',
    make: 'Yamaha',
    model: 'MT-09',
    year: 2019,
    engineCc: null,
    currentMileage: 1_000,
  };

  it('uses the measurement system passed in over the users row (the client writes it later)', async () => {
    const { service, adminQueries, userClient, userQueries } = serviceWith({
      modelRows: MODEL_ROWS,
      measurementSystem: 'metric',
    });
    const result = await service.importServicePlan(userClient, {
      ...bike,
      measurementSystem: 'imperial',
    });

    expect(adminQueries.some((q) => q.table === 'users')).toBe(false);
    const inserted = userQueries.find((q) => q.table === 'maintenance_tasks')
      ?.insertPayload as Array<{ target_mileage: number }>;
    // 10,000 km = 6,214 mi; 1,000 km = 621 mi, added to the raw odometer.
    expect(inserted.map((t) => t.target_mileage)).toEqual([1_000 + 6_214, 1_000 + 621]);
    expect(result).toEqual({
      taskCount: 2,
      insertedCount: 2,
      tier: SERVICE_PLAN_TIER.MODEL,
      measurementSystem: 'imperial',
    });
  });

  it('falls back to users.measurement_system when no system is passed', async () => {
    const { service, userClient, userQueries } = serviceWith({
      modelRows: MODEL_ROWS,
      measurementSystem: 'metric',
    });
    const result = await service.importServicePlan(userClient, bike);
    const inserted = userQueries.find((q) => q.table === 'maintenance_tasks')
      ?.insertPayload as Array<{ target_mileage: number }>;
    expect(inserted.map((t) => t.target_mileage)).toEqual([11_000, 2_000]);
    expect(result.measurementSystem).toBe('metric');
  });

  it('labels a make-generic plan with the make tier', async () => {
    const { service, userClient } = serviceWith({ makeRows: MAKE_ROWS });
    const result = await service.importServicePlan(userClient, {
      ...bike,
      make: 'Honda',
      model: '',
    });
    expect(result.tier).toBe(SERVICE_PLAN_TIER.MAKE);
    expect(result.taskCount).toBe(1);
  });

  it('inserts nothing when the plan is already there (no duplicates on a second run)', async () => {
    const { service, userClient, userQueries } = serviceWith({
      modelRows: MODEL_ROWS,
      existing: [{ oem_schedule_id: 's-oil' }, { oem_schedule_id: 's-chain' }],
    });
    const result = await service.importServicePlan(userClient, bike);
    expect(userQueries.some((q) => q.insertPayload)).toBe(false);
    expect(result).toMatchObject({ taskCount: 2, insertedCount: 0, tier: SERVICE_PLAN_TIER.MODEL });
  });
});
