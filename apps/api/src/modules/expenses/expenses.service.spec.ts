import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesService } from './expenses.service';

/** Helper to build a chainable Supabase mock that records calls. */
function createSupabaseMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.single = vi.fn();
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);

  const from = vi.fn().mockReturnValue(chain);
  const rpc = vi.fn();

  return { from, chain, rpc };
}

describe('ExpensesService', () => {
  let service: ExpensesService;
  let mock: ReturnType<typeof createSupabaseMock>;
  let adminMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createSupabaseMock();
    // MOT-143: ExpensesService now takes SUPABASE_USER + SUPABASE_ADMIN + ConfigService.
    // The admin mock is separate: createFromTask reads users.currency via service role
    // (column grants, migration 00141).
    adminMock = createSupabaseMock();
    const configMock = { get: vi.fn().mockReturnValue('https://example.supabase.co') };
    // biome-ignore lint/suspicious/noExplicitAny: test mock instantiation
    service = new (ExpensesService as any)(mock, adminMock, configMock);
    // Suppress logger output during tests
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  // ---------------------------------------------------------------------------
  // findByMotorcycle
  // ---------------------------------------------------------------------------
  describe('findByMotorcycle', () => {
    it('returns grouped expenses with correct totals', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            user_id: 'u1',
            motorcycle_id: 'm1',
            amount: '50.00',
            category: 'fuel',
            date: '2025-03-01',
            description: null,
            maintenance_task_id: null,
            created_at: '2025-03-01T00:00:00Z',
          },
          {
            id: '2',
            user_id: 'u1',
            motorcycle_id: 'm1',
            amount: '120.00',
            category: 'maintenance',
            date: '2025-03-05',
            description: 'Oil change',
            maintenance_task_id: 't1',
            created_at: '2025-03-05T00:00:00Z',
          },
          {
            id: '3',
            user_id: 'u1',
            motorcycle_id: 'm1',
            amount: '30.00',
            category: 'fuel',
            date: '2025-02-15',
            description: null,
            maintenance_task_id: null,
            created_at: '2025-02-15T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await service.findByMotorcycle('u1', 'm1');

      expect(result.ytdTotal).toBe(200);
      expect(result.categories).toHaveLength(2);

      const fuel = result.categories.find((c) => c.category === 'fuel');
      expect(fuel?.total).toBe(80);
      expect(fuel?.expenses).toHaveLength(2);

      const maint = result.categories.find((c) => c.category === 'maintenance');
      expect(maint?.total).toBe(120);
      expect(maint?.expenses).toHaveLength(1);
    });

    it('maps amount string to number correctly ("99.99" -> 99.99)', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: [
          {
            id: '1',
            user_id: 'u1',
            motorcycle_id: 'm1',
            amount: '99.99',
            category: 'parts',
            date: '2025-01-10',
            description: null,
            maintenance_task_id: null,
            created_at: '2025-01-10T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await service.findByMotorcycle('u1', 'm1');

      expect(result.categories[0].expenses[0].amount).toBe(99.99);
      expect(typeof result.categories[0].expenses[0].amount).toBe('number');
    });

    it('with year filter applies date range', async () => {
      mock.chain.order.mockReturnValue(mock.chain);
      mock.chain.lte.mockResolvedValueOnce({ data: [], error: null });

      await service.findByMotorcycle('u1', 'm1', 2025);

      expect(mock.chain.gte).toHaveBeenCalledWith('date', '2025-01-01');
      expect(mock.chain.lte).toHaveBeenCalledWith('date', '2025-12-31');
    });

    it('year=0 means no year filter (all-time)', async () => {
      mock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      await service.findByMotorcycle('u1', 'm1', 0);

      // gte/lte should only have been called by the base chain (.is calls), not for date filtering
      // The chain calls .eq, .eq, .is, .order — no .gte or .lte for date
      expect(mock.chain.gte).not.toHaveBeenCalledWith('date', expect.any(String));
    });

    it('throws BadRequestException for invalid year', async () => {
      await expect(service.findByMotorcycle('u1', 'm1', 1999)).rejects.toThrow(BadRequestException);
      await expect(service.findByMotorcycle('u1', 'm1', 2101)).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // create (logExpense)
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('inserts with correct snake_case mapping and returns mapped result', async () => {
      const input = {
        motorcycleId: 'm1',
        amount: 45.5,
        category: 'fuel',
        date: '2025-06-01',
        description: 'Gas station',
      };

      mock.chain.single.mockResolvedValueOnce({
        data: {
          id: 'new-1',
          user_id: 'u1',
          motorcycle_id: 'm1',
          amount: '45.50',
          category: 'fuel',
          date: '2025-06-01',
          description: 'Gas station',
          maintenance_task_id: null,
          created_at: '2025-06-01T12:00:00Z',
        },
        error: null,
      });

      const result = await service.create('u1', input);

      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: 'u1',
        motorcycle_id: 'm1',
        amount: 45.5,
        category: 'fuel',
        date: '2025-06-01',
        description: 'Gas station',
      });
      expect(result.id).toBe('new-1');
      expect(result.motorcycleId).toBe('m1');
      expect(result.amount).toBe(45.5);
      expect(result.category).toBe('fuel');
      expect(result.description).toBe('Gas station');
    });
  });

  // ---------------------------------------------------------------------------
  // softDelete
  // ---------------------------------------------------------------------------
  describe('softDelete', () => {
    it('sets deleted_at and scopes by user_id, returns true', async () => {
      mock.chain.single.mockResolvedValueOnce({
        data: { id: 'exp-1' },
        error: null,
      });

      const result = await service.softDelete('u1', 'exp-1');

      expect(result).toBe(true);
      expect(mock.from).toHaveBeenCalledWith('expenses');
      expect(mock.chain.update).toHaveBeenCalledWith({
        deleted_at: expect.any(String),
      });
      expect(mock.chain.eq).toHaveBeenCalledWith('id', 'exp-1');
      expect(mock.chain.eq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('throws BadRequestException on error', async () => {
      mock.chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found', code: 'PGRST116' },
      });

      await expect(service.softDelete('u1', 'exp-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // createFromTask
  // ---------------------------------------------------------------------------
  describe('createFromTask', () => {
    it('inserts expense linked to task', async () => {
      // Admin-client single(): user currency lookup (column grants, 00141)
      adminMock.chain.single.mockResolvedValueOnce({
        data: { currency: 'EUR' },
        error: null,
      });
      // User-client single(): expense insert
      mock.chain.single.mockResolvedValueOnce({
        data: {
          id: 'exp-task-1',
          user_id: 'u1',
          motorcycle_id: 'm1',
          amount: '25.00',
          category: 'maintenance',
          currency: 'EUR',
          date: '2025-06-15',
          description: 'Change oil filter',
          maintenance_task_id: 'task-1',
          created_at: '2025-06-15T00:00:00Z',
        },
        error: null,
      });

      const result = await service.createFromTask('u1', 'm1', 'task-1', 25, 'Change oil filter');

      expect(result).not.toBeNull();
      expect(result?.maintenanceTaskId).toBe('task-1');
      expect(result?.category).toBe('maintenance');
      expect(mock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'u1',
          motorcycle_id: 'm1',
          maintenance_task_id: 'task-1',
          amount: 25,
          category: 'maintenance',
          description: 'Change oil filter',
        }),
      );
    });

    it('suppresses duplicate (Postgres error code 23505, returns null)', async () => {
      // Admin-client single(): user currency lookup
      adminMock.chain.single.mockResolvedValueOnce({
        data: { currency: 'USD' },
        error: null,
      });
      // Expense insert fails with duplicate
      mock.chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'duplicate key', code: '23505' },
      });

      const result = await service.createFromTask('u1', 'm1', 'task-1', 25, 'Change oil filter');

      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // getDashboard
  // ---------------------------------------------------------------------------
  describe('getDashboard', () => {
    it('maps the SQL-aggregated RPC payload into the dashboard shape', async () => {
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      // H10: aggregation now runs in SQL (expense_dashboard_aggregates) — the
      // service maps the JSONB payload rather than summing rows in JS.
      mock.rpc.mockResolvedValueOnce({
        data: {
          currentYearTotal: 300.5,
          previousYearTotal: 125.25,
          allTimeTotal: 425.75,
          expenseCount: 4,
          monthlyBuckets: [
            {
              year: currentYear,
              month: 3,
              categories: { fuel: 100, maintenance: 200.5 },
              total: 300.5,
            },
            {
              year: previousYear,
              month: 11,
              categories: { fuel: 50, parts: 75.25 },
              total: 125.25,
            },
          ],
          categoryTotals: [
            { category: 'maintenance', total: 200.5 },
            { category: 'fuel', total: 150 },
            { category: 'parts', total: 75.25 },
          ],
        },
        error: null,
      });

      const result = await service.getDashboard('u1', 'm1');

      expect(mock.rpc).toHaveBeenCalledWith('expense_dashboard_aggregates', {
        p_motorcycle_id: 'm1',
      });

      expect(result.currentYearTotal).toBe(300.5);
      expect(result.previousYearTotal).toBe(125.25);
      expect(result.allTimeTotal).toBe(425.75);
      expect(result.expenseCount).toBe(4);

      const marchBucket = result.monthlyBuckets.find(
        (b) => b.year === currentYear && b.month === 3,
      );
      expect(marchBucket).toBeDefined();
      expect(marchBucket?.fuel).toBe(100);
      expect(marchBucket?.maintenance).toBe(200.5);
      expect(marchBucket?.total).toBe(300.5);
      // Categories not present in the bucket default to 0.
      expect(marchBucket?.parts).toBe(0);

      const fuelCat = result.categoryTotals.find((c) => c.category === 'fuel');
      expect(fuelCat?.total).toBe(150);
    });

    it('handles an empty dashboard (RPC returns zeros + empty arrays)', async () => {
      mock.rpc.mockResolvedValueOnce({
        data: {
          currentYearTotal: 0,
          previousYearTotal: 0,
          allTimeTotal: 0,
          expenseCount: 0,
          monthlyBuckets: [],
          categoryTotals: [],
        },
        error: null,
      });

      const result = await service.getDashboard('u1', 'm1');

      expect(result.currentYearTotal).toBe(0);
      expect(result.previousYearTotal).toBe(0);
      expect(result.allTimeTotal).toBe(0);
      expect(result.expenseCount).toBe(0);
      expect(result.monthlyBuckets).toEqual([]);
      expect(result.categoryTotals).toEqual([]);
    });
  });
});
