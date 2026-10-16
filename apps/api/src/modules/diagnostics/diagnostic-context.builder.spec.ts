import { MeasurementSystem } from '@motovault/types';
import { Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type BuildBikeContextParams,
  DiagnosticContextBuilder,
  MECHANICAL_EXPENSE_CATEGORIES,
  resolveBikeContextScope,
} from './diagnostic-context.builder';
import { BIKE_CONTEXT_SCOPE } from './diagnostic-context.format';

type QueryResult = { data: unknown; error: { message: string } | null };
type Filters = Record<string, unknown>;
type Resolve = (table: string, filters: Filters) => QueryResult;

const OK_EMPTY: QueryResult = { data: [], error: null };
const COMPLETED = 'completed';

/**
 * Chainable, awaitable PostgREST builder mock. Records `eq`/`in` filters so a
 * test can answer per table (and per status) without tracking call order.
 */
function mockSupabase(resolve: Resolve) {
  const tables: string[] = [];
  const client = {
    from: vi.fn((table: string) => {
      tables.push(table);
      const filters: Filters = {};
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'is', 'gte', 'neq', 'order', 'limit']) {
        builder[method] = vi.fn(() => builder);
      }
      builder.eq = vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return builder;
      });
      builder.in = vi.fn((column: string, values: unknown) => {
        filters[column] = values;
        return builder;
      });
      // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable
      builder.then = (onFulfilled: (value: QueryResult) => unknown) =>
        Promise.resolve(resolve(table, filters)).then(onFulfilled);
      return builder;
    }),
  };
  return { client: client as unknown as SupabaseClient, tables };
}

const params = (overrides: Partial<BuildBikeContextParams> = {}): BuildBikeContextParams => ({
  userId: 'user-1',
  motorcycleId: 'bike-1',
  currentDiagnosticId: 'diag-now',
  scope: BIKE_CONTEXT_SCOPE.FULL,
  measurementSystem: MeasurementSystem.METRIC,
  currentMileage: 20_000,
  symptoms: { location: 'electrical' },
  now: new Date('2026-10-16T12:00:00Z'),
  ...overrides,
});

const ROWS: Record<string, unknown[]> = {
  completedTasks: [
    { title: 'Stator replaced', completed_at: '2026-06-01T00:00:00Z', completed_mileage: 18_000 },
  ],
  openTasks: [{ title: 'Valve check', due_date: '2026-05-01' }],
  expenses: [{ category: 'parts', item_name: 'Regulator', description: null, date: '2026-09-02' }],
  rides: [{ started_at: '2026-10-10T08:00:00Z', distance_m: 42_000 }],
  diagnostics: [
    {
      created_at: '2026-09-10T00:00:00Z',
      severity: 'medium',
      description: 'Weak stator',
      free_text_description: 'Battery light',
      part: 'Stator',
    },
  ],
  notes: [{ body: 'Fitted heated grips', created_at: '2026-08-01T00:00:00Z', odometer: 17_500 }],
};

const happyResolve: Resolve = (table, filters) => {
  if (table === 'maintenance_tasks') {
    return {
      data: filters.status === COMPLETED ? ROWS.completedTasks : ROWS.openTasks,
      error: null,
    };
  }
  return { data: ROWS[table] ?? [], error: null };
};

describe('resolveBikeContextScope', () => {
  it.each([
    [{ includeBikeHistory: true }, BIKE_CONTEXT_SCOPE.FULL],
    [{ includeBikeHistory: true, includeMaintenanceHistory: false }, BIKE_CONTEXT_SCOPE.FULL],
    [{ includeBikeHistory: false, includeMaintenanceHistory: true }, null],
    [{ includeMaintenanceHistory: true }, BIKE_CONTEXT_SCOPE.MAINTENANCE],
    [{ includeBikeHistory: null, includeMaintenanceHistory: true }, BIKE_CONTEXT_SCOPE.MAINTENANCE],
    [{ includeMaintenanceHistory: false }, null],
    [{}, null],
  ])('maps %o to %s', (flags, expected) => {
    expect(resolveBikeContextScope(flags)).toBe(expected);
  });
});

describe('MECHANICAL_EXPENSE_CATEGORIES', () => {
  it('covers parts, service, tyres, accessories and mods but not fuel, gear or the catch-all', () => {
    expect([...MECHANICAL_EXPENSE_CATEGORIES].sort()).toEqual(
      ['accessories', 'maintenance', 'modifications', 'parts', 'tires'].sort(),
    );
  });
});

describe('DiagnosticContextBuilder.build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('renders every section of the full scope from the rider data', async () => {
    // Arrange
    const { client } = mockSupabase(happyResolve);
    const builder = new DiagnosticContextBuilder(client);

    // Act
    const result = await builder.build(params({ profile: { variant: 'FXDWG' } }));

    // Assert
    expect(result).toContain('- Variant: FXDWG');
    expect(result).toContain('Valve check | OVERDUE');
    expect(result).toContain('2026-06-01 | Stator replaced | at 18,000 km');
    expect(result).toContain('2026-09-02 | Parts | Regulator');
    expect(result).toContain('Rides in the last 90 days: 1 (42 km)');
    expect(result).toContain(
      'rider reported: "Battery light" | assessed: part Stator, severity medium',
    );
    expect(result).toContain('Fitted heated grips');
  });

  it('reads only maintenance tasks for the legacy maintenance-history scope', async () => {
    // Arrange
    const { client, tables } = mockSupabase(happyResolve);
    const builder = new DiagnosticContextBuilder(client);

    // Act
    const result = await builder.build(params({ scope: BIKE_CONTEXT_SCOPE.MAINTENANCE }));

    // Assert
    expect(new Set(tables)).toEqual(new Set(['maintenance_tasks']));
    expect(result).toContain('Stator replaced');
    expect(result).not.toContain('Regulator');
    expect(result).not.toContain('Fitted heated grips');
  });

  it('omits a section whose query returns an error, logs only ids, and still renders the rest', async () => {
    // Arrange
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { client } = mockSupabase((table, filters) =>
      table === 'notes'
        ? { data: null, error: { message: 'permission denied' } }
        : happyResolve(table, filters),
    );
    const builder = new DiagnosticContextBuilder(client);

    // Act
    const result = await builder.build(params());

    // Assert
    expect(result).not.toContain("Owner's notes");
    expect(result).toContain('Regulator');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('"notes" skipped for motorcycleId=bike-1'),
    );
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('heated grips'));
  });

  it('asks the database for mechanical categories and completed rides only', async () => {
    // Arrange
    const seen: Record<string, Filters> = {};
    const { client } = mockSupabase((table, filters) => {
      seen[table] = filters;
      return OK_EMPTY;
    });
    const builder = new DiagnosticContextBuilder(client);

    // Act
    await builder.build(params());

    // Assert
    expect(seen.expenses.category).toEqual([...MECHANICAL_EXPENSE_CATEGORIES]);
    expect(seen.rides.status).toBe(COMPLETED);
    expect(seen.expenses).toMatchObject({ user_id: 'user-1', motorcycle_id: 'bike-1' });
  });

  it('returns undefined when the bike has no history', async () => {
    const { client } = mockSupabase(() => OK_EMPTY);
    const builder = new DiagnosticContextBuilder(client);

    expect(await builder.build(params())).toBeUndefined();
  });
});
