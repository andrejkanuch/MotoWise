import type { ExtractedScheduleDraft, ExtractedSpecDraft } from '@motovault/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { MaintenanceSourcingService } from './maintenance-sourcing.service';

type QueryResult = { data: unknown; error: unknown };

interface RecordedQuery {
  table: string;
  op: 'select' | 'insert' | 'update';
  filters: Array<{ column: string; value: unknown }>;
  insertPayload?: Record<string, unknown>;
  updatePayload?: Record<string, unknown>;
}

/**
 * Chainable Supabase mock (pattern from oem-schedules.service.spec.ts). Records the table, the
 * op (select/insert/update), every `.eq/.is` filter, and any insert/update payload, then resolves
 * chains terminating in `.single`, `.maybeSingle`, or `await`.
 */
function createMockSupabase(resultFor: (q: RecordedQuery) => QueryResult) {
  const queries: RecordedQuery[] = [];

  function makeBuilder(table: string) {
    const record: RecordedQuery = { table, op: 'select', filters: [] };
    queries.push(record);
    const result = (): QueryResult => resultFor(record);

    const builder = {
      select: () => builder,
      insert: (payload: Record<string, unknown>) => {
        record.op = 'insert';
        record.insertPayload = payload;
        return builder;
      },
      update: (payload: Record<string, unknown>) => {
        record.op = 'update';
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
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      // biome-ignore lint/suspicious/noThenProperty: chainable Supabase mock must be awaitable
      then: (onFulfilled: (r: QueryResult) => unknown) =>
        Promise.resolve(result()).then(onFulfilled),
    };
    return builder;
  }

  const client = { from: (table: string) => makeBuilder(table) } as unknown as SupabaseClient;
  return { client, queries };
}

function serviceWith(resultFor: (q: RecordedQuery) => QueryResult) {
  const mock = createMockSupabase(resultFor);
  return { service: new MaintenanceSourcingService(mock.client), queries: mock.queries };
}

// A "row not found" select result (so persist takes the INSERT branch, not UPDATE).
const NOT_FOUND: QueryResult = { data: null, error: null };

const scheduleDraft = (over: Partial<ExtractedScheduleDraft> = {}): ExtractedScheduleDraft => ({
  taskName: 'Engine oil change',
  intervalKm: 12000,
  priority: 'high',
  sourcePage: 'p.214',
  sourceContext: 'Cambie el aceite del motor cada 12.000 km',
  ...over,
});

const specDraft = (over: Partial<ExtractedSpecDraft> = {}): ExtractedSpecDraft => ({
  specType: 'valve_clearance',
  specName: 'Valve clearance (intake)',
  valueNumeric: 0.2,
  valueDisplay: '0.20 mm',
  unit: 'mm',
  sourcePage: 'p.230',
  sourceContext: 'Valve clearance (intake): 0.20 mm (cold)',
  ...over,
});

describe('MaintenanceSourcingService — server-set is_safety_critical (KTD 8)', () => {
  let inserts: RecordedQuery[];

  beforeEach(() => {
    inserts = [];
  });

  it('sets is_safety_critical from the allowlist for a schedule, NOT from input', async () => {
    const { service, queries } = serviceWith((q) =>
      q.op === 'select' ? NOT_FOUND : { data: { id: 'new' }, error: null },
    );

    await service.persistDrafts({
      sourceId: 'src-1',
      schedules: [scheduleDraft({ taskName: 'Engine oil change' })],
      specs: [],
    });

    inserts = queries.filter((q) => q.table === 'oem_maintenance_schedules' && q.op === 'insert');
    expect(inserts).toHaveLength(1);
    // 'engine oil' is on SAFETY_CRITICAL_ALLOWLIST → server marks it true.
    expect(inserts[0].insertPayload?.is_safety_critical).toBe(true);
    expect(inserts[0].insertPayload?.is_verified).toBe(false);
  });

  it('marks a non-allowlisted task NOT safety-critical regardless of any model claim', async () => {
    const { service, queries } = serviceWith((q) =>
      q.op === 'select' ? NOT_FOUND : { data: { id: 'new' }, error: null },
    );

    // The draft type has no is_safety_critical field — the only source of truth is the allowlist.
    await service.persistDrafts({
      sourceId: 'src-1',
      schedules: [scheduleDraft({ taskName: 'Air filter inspection' })],
      specs: [],
    });

    const ins = queries.find((q) => q.table === 'oem_maintenance_schedules' && q.op === 'insert');
    expect(ins?.insertPayload?.is_safety_critical).toBe(false);
  });

  it('sets is_safety_critical for a spec via the allowlist (valve clearance)', async () => {
    const { service, queries } = serviceWith((q) =>
      q.op === 'select' ? NOT_FOUND : { data: { id: 'new' }, error: null },
    );

    await service.persistDrafts({
      sourceId: 'src-1',
      schedules: [],
      specs: [specDraft({ specName: 'Valve clearance (intake)' })],
    });

    const ins = queries.find((q) => q.table === 'motorcycle_specs' && q.op === 'insert');
    expect(ins?.insertPayload?.is_safety_critical).toBe(true);
    expect(ins?.insertPayload?.is_verified).toBe(false);
  });
});

describe('MaintenanceSourcingService — out-of-range spec rejection', () => {
  it('rejects an out-of-physical-range spec and does NOT insert it', async () => {
    const { service, queries } = serviceWith((q) =>
      q.op === 'select' ? NOT_FOUND : { data: { id: 'new' }, error: null },
    );

    const result = await service.persistDrafts({
      sourceId: 'src-1',
      schedules: [],
      // torque range is 1–500 Nm; 5000 is a fabrication → rejected before insert.
      specs: [
        specDraft({
          specType: 'torque',
          specName: 'Axle nut torque',
          valueNumeric: 5000,
          unit: 'Nm',
        }),
      ],
    });

    expect(result.specsUpserted).toBe(0);
    expect(result.specsRejected).toBe(1);
    expect(result.rejectedSpecNames).toContain('Axle nut torque');
    expect(queries.some((q) => q.table === 'motorcycle_specs' && q.op === 'insert')).toBe(false);
  });

  it('accepts an in-range spec and writes value_numeric + value_display', async () => {
    const { service, queries } = serviceWith((q) =>
      q.op === 'select' ? NOT_FOUND : { data: { id: 'new' }, error: null },
    );

    const result = await service.persistDrafts({
      sourceId: 'src-1',
      schedules: [],
      specs: [specDraft()],
    });

    expect(result.specsUpserted).toBe(1);
    const ins = queries.find((q) => q.table === 'motorcycle_specs' && q.op === 'insert');
    expect(ins?.insertPayload?.value_numeric).toBe(0.2);
    expect(ins?.insertPayload?.value_display).toBe('0.20 mm');
    expect(ins?.insertPayload?.unit).toBe('mm');
  });
});

describe('MaintenanceSourcingService — idempotency & provenance', () => {
  it('UPDATEs an existing draft instead of inserting a duplicate (select-then-dedup)', async () => {
    const { service, queries } = serviceWith((q) => {
      // The natural-key lookup finds an existing row → take the UPDATE branch.
      if (q.op === 'select') return { data: { id: 'existing-1' }, error: null };
      return { data: { id: 'existing-1' }, error: null };
    });

    await service.persistDrafts({
      sourceId: 'src-1',
      schedules: [scheduleDraft()],
      specs: [],
    });

    expect(queries.some((q) => q.table === 'oem_maintenance_schedules' && q.op === 'insert')).toBe(
      false,
    );
    expect(queries.some((q) => q.table === 'oem_maintenance_schedules' && q.op === 'update')).toBe(
      true,
    );
  });

  it('stamps make/model/variant and source_id on persisted rows', async () => {
    const { service, queries } = serviceWith((q) =>
      q.op === 'select' ? NOT_FOUND : { data: { id: 'new' }, error: null },
    );

    await service.persistDrafts({
      sourceId: 'src-42',
      schedules: [scheduleDraft()],
      specs: [],
    });

    const ins = queries.find((q) => q.table === 'oem_maintenance_schedules' && q.op === 'insert');
    expect(ins?.insertPayload).toMatchObject({
      make: 'HONDA',
      model: 'CRF1100',
      variant: 'DCT',
      source_id: 'src-42',
    });
  });

  it('registers a source and logs the run as maintenance_extraction', async () => {
    const { service, queries } = serviceWith((q) => {
      if (q.table === 'maintenance_data_sources' && q.op === 'select') return NOT_FOUND;
      if (q.table === 'maintenance_data_sources' && q.op === 'insert')
        return {
          data: {
            id: 'src-new',
            source_type: 'owner_manual',
            title: 'CRF1100 OM',
            reference: '31MKS800',
          },
          error: null,
        };
      return q.op === 'select' ? NOT_FOUND : { data: { id: 'new' }, error: null };
    });

    const source = await service.registerSource({
      sourceType: 'owner_manual',
      title: 'CRF1100 OM',
      editionLanguage: 'en',
      marketApplicability: 'US',
      reference: '31MKS800',
    });
    expect(source.id).toBe('src-new');

    await service.persistDrafts({ sourceId: source.id, schedules: [scheduleDraft()], specs: [] });

    const log = queries.find((q) => q.table === 'content_generation_log' && q.op === 'insert');
    expect(log?.insertPayload?.content_type).toBe('maintenance_extraction');
    expect(log?.insertPayload?.status).toBe('success');
  });
});
