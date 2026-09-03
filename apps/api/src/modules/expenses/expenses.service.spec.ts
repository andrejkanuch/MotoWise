import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpensesService } from './expenses.service';

/** Helper to build a chainable Supabase mock that records calls. */
function createSupabaseMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.is = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.lte = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);

  const from = vi.fn().mockReturnValue(chain);
  const rpc = vi.fn();

  // Storage: createSignedUrl (receipts resolve) + remove (record-delete purge).
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: 'https://signed/url?token=abc' }, error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  const storageBucket = { createSignedUrl, remove };
  const storage = { from: vi.fn().mockReturnValue(storageBucket) };

  return { from, chain, rpc, storage, createSignedUrl, remove };
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
        item_name: null,
      });
      expect(result.id).toBe('new-1');
      expect(result.motorcycleId).toBe('m1');
      expect(result.amount).toBe(45.5);
      expect(result.category).toBe('fuel');
      expect(result.description).toBe('Gas station');
    });

    it('persists the optional itemName as item_name and maps it back', async () => {
      const input = {
        motorcycleId: 'm1',
        amount: 336.16,
        category: 'accessories',
        date: '2025-06-01',
        itemName: 'GPR-Tech Alpi-Tech 55L top case',
      };

      mock.chain.single.mockResolvedValueOnce({
        data: {
          id: 'new-2',
          user_id: 'u1',
          motorcycle_id: 'm1',
          amount: '336.16',
          category: 'accessories',
          date: '2025-06-01',
          description: null,
          item_name: 'GPR-Tech Alpi-Tech 55L top case',
          maintenance_task_id: null,
          created_at: '2025-06-01T12:00:00Z',
        },
        error: null,
      });

      const result = await service.create('u1', input);

      expect(mock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'accessories',
          item_name: 'GPR-Tech Alpi-Tech 55L top case',
        }),
      );
      expect(result.itemName).toBe('GPR-Tech Alpi-Tech 55L top case');
      expect(result.category).toBe('accessories');
    });
  });

  // ---------------------------------------------------------------------------
  // softDelete
  // ---------------------------------------------------------------------------
  describe('softDelete', () => {
    it('deletes through the soft_delete_expense RPC and returns true', async () => {
      mock.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await service.softDelete('u1', 'exp-1');

      expect(result).toBe(true);
      expect(mock.rpc).toHaveBeenCalledWith('soft_delete_expense', { expense_id: 'exp-1' });
    });

    it('never issues a direct UPDATE against expenses', async () => {
      // Regression guard for MOTO-VAULT-REACT-NATIVE-1M. A direct UPDATE cannot
      // work here on ANY client: `Users read own expenses` is
      // `USING (auth.uid() = user_id AND deleted_at IS NULL)`, PostgreSQL
      // applies SELECT policies to the NEW row of an UPDATE whenever the
      // statement reads table columns (a WHERE clause does it), and stamping
      // deleted_at makes that row invisible — 42501, for every rider, not a
      // subset. Rewriting this back into a `.update()` re-breaks deletion
      // entirely, whichever client it is issued on, so the assertion covers
      // both.
      mock.rpc.mockResolvedValueOnce({ data: true, error: null });

      await service.softDelete('u1', 'exp-1');

      expect(mock.chain.update).not.toHaveBeenCalled();
      expect(adminMock.chain.update).not.toHaveBeenCalled();
    });

    it('uses the user client, so RLS still applies to the call', async () => {
      // The RPC is SECURITY DEFINER and pins user_id = auth.uid() internally.
      // That only holds if it is invoked with the caller's JWT — on the
      // service-role client auth.uid() is null and the function would refuse
      // every delete. Ownership lives in the database precisely because this
      // call is NOT made as admin.
      mock.rpc.mockResolvedValueOnce({ data: true, error: null });

      await service.softDelete('u1', 'exp-1');

      expect(mock.rpc).toHaveBeenCalled();
      expect(adminMock.rpc).not.toHaveBeenCalled();
    });

    it('returns true idempotently when the user has no such expense', async () => {
      // A double-tap / stale-list / retry against an already-deleted, missing,
      // or non-owned expense returns false from the RPC. The caller's intent
      // ("this is gone") already holds, so we return true rather than throwing
      // BAD_REQUEST (regression guard for MOTO-VAULT-REACT-NATIVE-1J), and we
      // avoid confirming whether the id exists on another account.
      mock.rpc.mockResolvedValueOnce({ data: false, error: null });

      await expect(service.softDelete('u1', 'exp-1')).resolves.toBe(true);
    });

    it('skips the receipts purge when nothing of theirs matched', async () => {
      mock.rpc.mockResolvedValueOnce({ data: false, error: null });

      await service.softDelete('u1', 'exp-1');

      expect(adminMock.storage.from).not.toHaveBeenCalled();
    });

    it('throws BadRequestException on a genuine DB error', async () => {
      mock.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection reset', code: '08006' },
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

    it('uses the task-provided currency and skips the profile lookup', async () => {
      // User-client single(): expense insert (no admin currency lookup expected).
      mock.chain.single.mockResolvedValueOnce({
        data: {
          id: 'exp-task-3',
          user_id: 'u1',
          motorcycle_id: 'm1',
          amount: '25.00',
          category: 'maintenance',
          currency: 'GBP',
          date: '2025-06-15',
          description: 'Scanned service',
          maintenance_task_id: 'task-1',
          created_at: '2025-06-15T00:00:00Z',
        },
        error: null,
      });

      const result = await service.createFromTask(
        'u1',
        'm1',
        'task-1',
        25,
        'Scanned service',
        'GBP',
      );

      expect(result?.currency).toBe('GBP');
      // The provided currency short-circuits the service-role profile read.
      expect(adminMock.chain.single).not.toHaveBeenCalled();
      expect(mock.chain.insert).toHaveBeenCalledWith(expect.objectContaining({ currency: 'GBP' }));
    });
  });

  // ---------------------------------------------------------------------------
  // Photos — mixed public/private resolution + C1 (U7a)
  // ---------------------------------------------------------------------------
  describe('photos (U7a)', () => {
    const UID = 'u1';
    const OTHER_UID = 'u2';

    it('resolves BOTH a legacy public URL and a receipts signed URL', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: [
          {
            id: 'p-legacy',
            expense_id: 'e1',
            user_id: UID,
            storage_path: `${UID}/expenses/e1/legacy.webp`,
            bucket: 'maintenance-photos',
            mime_type: 'image/webp',
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'p-receipt',
            expense_id: 'e1',
            user_id: UID,
            storage_path: `${UID}/scan.webp`,
            bucket: 'receipts',
            mime_type: 'image/webp',
            created_at: '2026-01-02T00:00:00Z',
          },
        ],
        error: null,
      });

      const photos = await service.findPhotosByExpenseId(UID, 'e1');

      expect(photos).toHaveLength(2);
      const legacy = photos.find((p) => p.id === 'p-legacy');
      expect(legacy?.publicUrl).toBe(
        `https://example.supabase.co/storage/v1/object/public/maintenance-photos/${UID}/expenses/e1/legacy.webp`,
      );
      const receipt = photos.find((p) => p.id === 'p-receipt');
      expect(receipt?.publicUrl).toBe('https://signed/url?token=abc');
      // Signed via the ADMIN client's receipts bucket.
      expect(adminMock.storage.from).toHaveBeenCalledWith('receipts');
      expect(adminMock.createSignedUrl).toHaveBeenCalledWith(`${UID}/scan.webp`, 120);
    });

    it('C1: drops a receipts photo whose path belongs to another uid', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: [
          {
            id: 'p-foreign',
            expense_id: 'e1',
            user_id: UID,
            storage_path: `${OTHER_UID}/scan.webp`,
            bucket: 'receipts',
            mime_type: 'image/webp',
            created_at: '2026-01-02T00:00:00Z',
          },
        ],
        error: null,
      });

      const photos = await service.findPhotosByExpenseId(UID, 'e1');

      expect(photos).toHaveLength(0);
      expect(adminMock.createSignedUrl).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // addPhoto — receipts-bucket linking (U7a)
  // ---------------------------------------------------------------------------
  describe('addPhoto (receipts link)', () => {
    it('sets bucket=receipts on insert and returns a signed URL', async () => {
      // Expense ownership lookup + insert both use .single().
      mock.chain.single
        .mockResolvedValueOnce({ data: { id: 'e1' }, error: null }) // ownership
        .mockResolvedValueOnce({
          data: {
            id: 'p-new',
            expense_id: 'e1',
            user_id: 'u1',
            storage_path: 'u1/scan.webp',
            bucket: 'receipts',
            mime_type: 'image/webp',
            created_at: '2026-01-02T00:00:00Z',
          },
          error: null,
        }); // insert

      const photo = await service.addPhoto('u1', 'e1', 'u1/scan.webp', undefined, 'receipts');

      expect(mock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ storage_path: 'u1/scan.webp', bucket: 'receipts' }),
      );
      expect(photo.publicUrl).toBe('https://signed/url?token=abc');
    });

    it('rejects a receipts path outside the caller uid folder', async () => {
      await expect(
        service.addPhoto('u1', 'e1', 'u2/scan.webp', undefined, 'receipts'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // softDelete — record delete purges receipts objects (U7a / R10)
  // ---------------------------------------------------------------------------
  describe('softDelete receipts purge', () => {
    it('removes the receipts storage object when the expense had one', async () => {
      // The delete itself resolves through the soft_delete_expense RPC (the RLS
      // footgun — see the softDelete suite); the purge that follows still reads
      // expense_photos through the user client.
      mock.rpc.mockResolvedValueOnce({ data: true, error: null });
      // The purge SELECT terminates on .eq('bucket', 'receipts') — resolve it.
      mock.chain.eq.mockImplementation((col: string) =>
        col === 'bucket'
          ? Promise.resolve({
              data: [{ id: 'p1', storage_path: 'u1/scan.webp', bucket: 'receipts', user_id: 'u1' }],
              error: null,
            })
          : mock.chain,
      );

      const ok = await service.softDelete('u1', 'e1');

      expect(ok).toBe(true);
      expect(adminMock.storage.from).toHaveBeenCalledWith('receipts');
      expect(adminMock.remove).toHaveBeenCalledWith(['u1/scan.webp']);
      // Link rows also removed.
      expect(mock.chain.delete).toHaveBeenCalled();
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
      expect(marchBucket?.total).toBe(300.5);
      // Only categories with spend are present (no zero padding); order follows
      // the RPC's category→amount map.
      expect(marchBucket?.categories).toEqual([
        { category: 'fuel', total: 100 },
        { category: 'maintenance', total: 200.5 },
      ]);

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
