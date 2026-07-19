import type { ReceiptExtraction } from '@motovault/types';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { AiBudgetService } from '../ai-budget/ai-budget.service';
import type { ExpensesService } from '../expenses/expenses.service';
import type { MaintenanceTasksService } from '../maintenance-tasks/maintenance-tasks.service';
import type { MotorcyclesService } from '../motorcycles/motorcycles.service';
import {
  RECEIPT_SCAN_ERROR_CODES,
  RECEIPT_SCAN_STATUS,
  RECORD_TYPES,
  UNDO_STATUS,
} from './receipt-scan.constants';
import { ReceiptScanService } from './receipt-scan.service';
import type { ReceiptScanAiService } from './receipt-scan-ai.service';

const RESERVATION_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_SCAN_ID = '22222222-2222-4222-8222-222222222222';
const MOTO_ID = '44444444-4444-4444-8444-444444444444';
const EXPENSE_ID = '55555555-5555-4555-8555-555555555555';
const TASK_ID = '66666666-6666-4666-8666-666666666666';
const PHOTO_ID = '77777777-7777-4777-8777-777777777777';
const STORAGE_PATH =
  '33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222.webp';

const USER: AuthUser = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'rider@example.com',
  role: 'authenticated',
  tier: 'free',
};

/** A full, valid dealer-invoice extraction (mirrors the U1 real sample). */
function dealerInvoiceExtraction(overrides: Partial<ReceiptExtraction> = {}): ReceiptExtraction {
  return {
    type: 'maintenance',
    amount: 241.46,
    currency: 'EUR',
    date: '2024-05-12',
    vendor: 'Taller Moto Barcelona',
    itemName: 'Major service',
    category: 'maintenance',
    partsCost: 110.45,
    laborCost: 89.1,
    odometerValue: 37505,
    odometerUnit: 'km',
    fuelLitres: null,
    vinOrPlate: 'VF1ABCDEF12345678',
    partsNeeded: ['oil filter', 'brake pads'],
    fieldConfidence: {
      amount: 0.98,
      currency: 0.99,
      date: 0.9,
      vendor: 0.85,
      category: 0.8,
      odometer: 0.7,
    },
    legibilityNote: null,
    ...overrides,
  };
}

interface RecordedCall {
  table: string;
  op: 'select' | 'update' | 'delete';
  patch?: Record<string, unknown>;
  filters: Record<string, unknown>;
  count: boolean;
  head: boolean;
  terminalSelect: boolean;
}

/**
 * Chainable Supabase mock. Every builder call is recorded into `calls`; the
 * awaited result is produced by a per-test `resolver(ctx)`. `rpc` / `download` /
 * inserts are separate spies.
 */
function createMockDb() {
  const calls: RecordedCall[] = [];
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const rpc = vi.fn();
  const download = vi.fn();
  const state: {
    resolver: (ctx: RecordedCall) => { data?: unknown; count?: number; error?: unknown };
    insertError: unknown;
  } = {
    // Default: a pending→success finalize CAS matches one row (the reservation is
    // still alive). Everything else resolves empty. Tests override as needed.
    resolver: (ctx) =>
      ctx.op === 'update' &&
      (ctx.patch as { status?: string })?.status === RECEIPT_SCAN_STATUS.SUCCESS
        ? { data: [{ id: RESERVATION_ID }], count: 0, error: null }
        : { data: [], count: 0, error: null },
    insertError: null,
  };

  function makeBuilder(table: string) {
    const ctx: RecordedCall = {
      table,
      op: 'select',
      patch: undefined,
      filters: {},
      count: false,
      head: false,
      terminalSelect: false,
    };
    const builder: Record<string, unknown> = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) {
        if (ctx.patch !== undefined) ctx.terminalSelect = true;
        if (opts?.count) ctx.count = true;
        if (opts?.head) ctx.head = true;
        return builder;
      },
      update(patch: Record<string, unknown>) {
        ctx.op = 'update';
        ctx.patch = patch;
        return builder;
      },
      insert(row: Record<string, unknown>) {
        inserts.push({ table, row });
        return Promise.resolve({ error: state.insertError });
      },
      delete() {
        ctx.op = 'delete';
        return builder;
      },
      eq(col: string, val: unknown) {
        ctx.filters[col] = val;
        return builder;
      },
      not(col: string, _op: string, val: unknown) {
        ctx.filters[`not_${col}`] = val;
        return builder;
      },
      is(col: string, val: unknown) {
        ctx.filters[`is_${col}`] = val;
        return builder;
      },
      gte(col: string, val: unknown) {
        ctx.filters[`gte_${col}`] = val;
        return builder;
      },
      lt(col: string, val: unknown) {
        ctx.filters[`lt_${col}`] = val;
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      // Terminal single-row resolvers (used by the U7b save/undo paths). Record
      // the call and resolve like the real client's `.single()`/`.maybeSingle()`.
      maybeSingle() {
        calls.push({ ...ctx, filters: { ...ctx.filters } });
        return Promise.resolve({ error: null, ...state.resolver(ctx) });
      },
      single() {
        calls.push({ ...ctx, filters: { ...ctx.filters } });
        return Promise.resolve({ error: null, ...state.resolver(ctx) });
      },
      // biome-ignore lint/suspicious/noThenProperty: the builder is intentionally a thenable so `await`-ed query chains resolve like the real Supabase client
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) {
        calls.push({ ...ctx, filters: { ...ctx.filters } });
        const result = state.resolver(ctx);
        return Promise.resolve({ error: null, ...result }).then(onF, onR);
      },
    };
    return builder;
  }

  const remove = vi.fn().mockResolvedValue({ error: null });
  const db = {
    from: (t: string) => makeBuilder(t),
    rpc,
    download,
    remove,
    storage: { from: () => ({ download, remove }) },
    calls,
    inserts,
    state,
  };
  return db;
}

describe('ReceiptScanService', () => {
  let db: ReturnType<typeof createMockDb>;
  let aiService: {
    detectImageMime: ReturnType<typeof vi.fn>;
    extract: ReturnType<typeof vi.fn>;
    model: string;
  };
  let aiBudget: { checkBudgetForUser: ReturnType<typeof vi.fn> };
  let expensesService: {
    create: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    addPhoto: ReturnType<typeof vi.fn>;
  };
  let maintenanceTasksService: {
    create: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    addPhoto: ReturnType<typeof vi.fn>;
  };
  let motorcyclesService: {
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let env: Record<string, string>;
  let service: ReceiptScanService;

  const build = () =>
    new ReceiptScanService(
      {
        get: (key: string, def?: string) => (key in env ? env[key] : def),
      } as unknown as ConfigService,
      db as never,
      aiBudget as unknown as AiBudgetService,
      aiService as unknown as ReceiptScanAiService,
      expensesService as unknown as ExpensesService,
      maintenanceTasksService as unknown as MaintenanceTasksService,
      motorcyclesService as unknown as MotorcyclesService,
    );

  const reserve = (overQuota: boolean) =>
    db.rpc.mockResolvedValue({
      data: [{ reservation_id: RESERVATION_ID, over_quota: overQuota }],
      error: null,
    });

  const validBytes = () => ({
    arrayBuffer: async () => new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db = createMockDb();
    env = {};
    aiService = {
      detectImageMime: vi.fn().mockReturnValue('image/webp'),
      extract: vi.fn(),
      model: 'gpt-4.1',
    };
    aiBudget = { checkBudgetForUser: vi.fn().mockResolvedValue(undefined) };
    expensesService = {
      create: vi.fn().mockResolvedValue({ id: EXPENSE_ID }),
      softDelete: vi.fn().mockResolvedValue(true),
      addPhoto: vi.fn().mockResolvedValue({ id: PHOTO_ID }),
    };
    maintenanceTasksService = {
      create: vi.fn().mockResolvedValue({ id: TASK_ID }),
      softDelete: vi.fn().mockResolvedValue(true),
      addPhoto: vi.fn().mockResolvedValue({ id: PHOTO_ID }),
    };
    motorcyclesService = {
      findById: vi.fn().mockResolvedValue({ id: MOTO_ID, currentMileage: 10_000 }),
      update: vi.fn().mockResolvedValue({ id: MOTO_ID }),
    };
    service = build();
  });

  const findUpdate = (status: string) =>
    db.calls.find((c) => c.op === 'update' && (c.patch as { status?: string })?.status === status);

  describe('scanReceipt — happy path', () => {
    beforeEach(() => {
      reserve(false);
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.extract.mockResolvedValue({
        ok: true,
        extraction: dealerInvoiceExtraction(),
        inputTokens: 900,
        outputTokens: 120,
      });
    });

    it('returns Success with the reservation id and mapped result', async () => {
      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('result' in res).toBe(true);
      if (!('result' in res)) return;
      expect(res.scanId).toBe(RESERVATION_ID);
      expect(res.result.amount).toBe(241.46);
      expect(res.result.currency).toBe('EUR');
      expect(res.result.category).toBe('maintenance');
      expect(res.result.odometerValue).toBe(37505);
      expect(res.result.odometerUnit).toBe('km');
      expect(res.result.needsCheck).toEqual([]);
    });

    it('checks the AI budget and fetches bytes via the derived {uid}/{scanId}.webp path', async () => {
      await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect(aiBudget.checkBudgetForUser).toHaveBeenCalledWith(USER.id);
      expect(db.download).toHaveBeenCalledWith(`${USER.id}/${CLIENT_SCAN_ID}.webp`);
    });

    it('persists the payload with VIN stripped (KTD-9) but odometer kept (KTD-7)', async () => {
      await service.scanReceipt(USER, CLIENT_SCAN_ID);
      const success = findUpdate(RECEIPT_SCAN_STATUS.SUCCESS);
      const payload = success?.patch?.extraction_payload as Record<string, unknown>;
      expect(payload).toBeDefined();
      expect('vinOrPlate' in payload).toBe(false);
      expect(payload.odometerValue).toBe(37505);
      expect(payload.schemaVersion).toBeDefined();
    });

    it('finalizes idempotently — success only from pending (CAS predicate)', async () => {
      await service.scanReceipt(USER, CLIENT_SCAN_ID);
      const success = findUpdate(RECEIPT_SCAN_STATUS.SUCCESS);
      expect(success?.filters.id).toBe(RESERVATION_ID);
      expect(success?.filters.status).toBe(RECEIPT_SCAN_STATUS.PENDING);
    });

    it('records a successful content_generation_log row (receipt_scan)', async () => {
      await service.scanReceipt(USER, CLIENT_SCAN_ID);
      const log = db.inserts.find((i) => i.table === 'content_generation_log');
      expect(log?.row.content_type).toBe('receipt_scan');
      expect(log?.row.status).toBe('success');
      expect(log?.row.input_tokens).toBe(900);
    });
  });

  describe('scanReceipt — idempotency (at-least-once retry dedup)', () => {
    it('returns the prior success for the same object WITHOUT reserving or re-charging', async () => {
      // A completed SUCCESS row already exists at this uid/scanId path (the first
      // call succeeded; the client retried after a lost response).
      db.state.resolver = (ctx) =>
        ctx.op === 'select' &&
        ctx.filters.storage_path === STORAGE_PATH &&
        ctx.filters.status === RECEIPT_SCAN_STATUS.SUCCESS
          ? {
              data: {
                id: RESERVATION_ID,
                extraction_payload: {
                  type: 'maintenance',
                  amount: 241.46,
                  currency: 'EUR',
                  date: '2024-05-12',
                  fieldConfidence: {
                    amount: 0.98,
                    currency: 0.99,
                    date: 0.9,
                    vendor: 0.85,
                    category: 0.8,
                    odometer: 0.7,
                  },
                },
              },
            }
          : { data: [], count: 0 };

      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);

      expect('result' in res).toBe(true);
      if (!('result' in res)) return;
      expect(res.scanId).toBe(RESERVATION_ID);
      expect(res.result.amount).toBe(241.46);
      // No second reservation, no second model call, no second spend row.
      expect(db.rpc).not.toHaveBeenCalled();
      expect(aiService.extract).not.toHaveBeenCalled();
      expect(db.download).not.toHaveBeenCalled();
      expect(db.inserts.find((i) => i.table === 'content_generation_log')).toBeUndefined();
    });
  });

  describe('scanReceipt — failure & guard paths', () => {
    it('kill switch → SCAN_DISABLED, no reservation', async () => {
      env.RECEIPT_SCAN_ENABLED = 'false';
      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SCAN_DISABLED);
      expect(db.rpc).not.toHaveBeenCalled();
    });

    it('C1 traversal scanId → IMAGE_INVALID before any reservation/path build', async () => {
      for (const bad of ['../../etc/passwd', 'foo/bar', 'not-a-uuid', '..']) {
        const res = await service.scanReceipt(USER, bad);
        expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID);
      }
      expect(db.rpc).not.toHaveBeenCalled();
      expect(db.download).not.toHaveBeenCalled();
    });

    it('non-image bytes → IMAGE_INVALID, row failed, NO model call, no spend', async () => {
      reserve(false);
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.detectImageMime.mockReturnValue(null);

      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID);
      expect(aiService.extract).not.toHaveBeenCalled();
      expect(findUpdate(RECEIPT_SCAN_STATUS.FAILED)?.filters.status).toBe(
        RECEIPT_SCAN_STATUS.PENDING,
      );
      expect(db.inserts.find((i) => i.table === 'content_generation_log')).toBeUndefined();
    });

    it('unreadable extraction → EXTRACTION_FAILED, row failed, failed spend logged', async () => {
      reserve(false);
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.extract.mockResolvedValue({ ok: false });

      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED);
      expect(findUpdate(RECEIPT_SCAN_STATUS.FAILED)).toBeDefined();
      const log = db.inserts.find((i) => i.table === 'content_generation_log');
      expect(log?.row.status).toBe('failed');
    });

    it('malformed model JSON (no parsed) → EXTRACTION_FAILED (no 500)', async () => {
      reserve(false);
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.extract.mockResolvedValue({ ok: false });
      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED);
    });

    it('extraction with all money-bearing fields null → EXTRACTION_FAILED (not success)', async () => {
      reserve(false);
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.extract.mockResolvedValue({
        ok: true,
        extraction: dealerInvoiceExtraction({ amount: null, currency: null, date: null }),
        inputTokens: 10,
        outputTokens: 5,
      });
      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED);
      expect(findUpdate(RECEIPT_SCAN_STATUS.FAILED)).toBeDefined();
    });

    it('finalize CAS matches 0 rows (reservation cancelled/reaped mid-extraction) → EXTRACTION_FAILED', async () => {
      reserve(false);
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.extract.mockResolvedValue({
        ok: true,
        extraction: dealerInvoiceExtraction(),
        inputTokens: 10,
        outputTokens: 5,
      });
      // The pending→success CAS matches nothing (the row is no longer pending).
      db.state.resolver = (ctx) =>
        ctx.op === 'update' &&
        (ctx.patch as { status?: string })?.status === RECEIPT_SCAN_STATUS.SUCCESS
          ? { data: [] }
          : { data: [], count: 0 };
      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.EXTRACTION_FAILED);
    });

    it('out-of-enum category → coerced to other + needs-check (no 500)', async () => {
      reserve(false);
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.extract.mockResolvedValue({
        ok: true,
        extraction: dealerInvoiceExtraction({ category: 'groceries' as never }),
        inputTokens: 10,
        outputTokens: 5,
      });

      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('result' in res).toBe(true);
      if (!('result' in res)) return;
      expect(res.result.category).toBe('other');
      expect(res.result.needsCheck).toContain('category');
    });
  });

  describe('scanReceipt — quota enforcement (KTD-3/5)', () => {
    beforeEach(() => {
      db.download.mockResolvedValue({ data: validBytes(), error: null });
      aiService.extract.mockResolvedValue({
        ok: true,
        extraction: dealerInvoiceExtraction(),
        inputTokens: 10,
        outputTokens: 5,
      });
    });

    it('shadow mode (over quota, flag off) → proceeds and returns Success', async () => {
      reserve(true);
      env.ENTITLEMENTS_ENFORCED = 'false';
      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('result' in res).toBe(true);
      expect(aiService.extract).toHaveBeenCalled();
    });

    it('enforce mode (over quota, flag on, free tier) → SCAN_QUOTA_EXCEEDED, row failed, no model call', async () => {
      reserve(true);
      env.ENTITLEMENTS_ENFORCED = 'true';
      const res = await service.scanReceipt(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SCAN_QUOTA_EXCEEDED);
      expect(aiService.extract).not.toHaveBeenCalled();
      expect(findUpdate(RECEIPT_SCAN_STATUS.FAILED)).toBeDefined();
    });

    it('enforce mode but Pro tier → proceeds (never blocked)', async () => {
      reserve(true);
      env.ENTITLEMENTS_ENFORCED = 'true';
      const res = await service.scanReceipt({ ...USER, tier: 'pro' }, CLIENT_SCAN_ID);
      expect('result' in res).toBe(true);
    });
  });

  describe('receiptScanQuota — tier independence (KTD-3)', () => {
    it('reports the raw used-count regardless of flag/tier', async () => {
      db.state.resolver = () => ({ count: 3 });
      const free = await service.receiptScanQuota(USER);
      const pro = await service.receiptScanQuota({ ...USER, tier: 'pro' });
      expect(free.used).toBe(3);
      expect(pro.used).toBe(3);
      expect(free.limit).toBe(3);
    });

    it('excludes onboarding + failed/cancelled rows from the count', async () => {
      db.state.resolver = () => ({ count: 1 });
      await service.receiptScanQuota(USER);
      const q = db.calls.find((c) => c.table === 'receipt_scans' && c.head);
      expect(q?.filters.is_onboarding).toBe(false);
      expect(q?.filters.not_status).toContain(RECEIPT_SCAN_STATUS.FAILED);
    });

    it('reaps this user own stale pendings before counting (no month-long lockout)', async () => {
      db.state.resolver = () => ({ count: 0 });
      await service.receiptScanQuota(USER);
      // A user-scoped pending->failed sweep with a created_at cutoff runs first, so
      // abandoned in-flight scans never inflate `used` and gate the paywall.
      const sweep = db.calls.find(
        (c) =>
          c.op === 'update' &&
          (c.patch as { status?: string })?.status === RECEIPT_SCAN_STATUS.FAILED &&
          c.filters.status === RECEIPT_SCAN_STATUS.PENDING,
      );
      expect(sweep).toBeDefined();
      expect(sweep?.filters.user_id).toBe(USER.id);
      expect(sweep?.filters.lt_created_at).toBeDefined();
    });
  });

  describe('cancelReceiptScan — CAS vs finalizer (KTD-4)', () => {
    it('cancel wins (pending row flips) → cancelled', async () => {
      db.state.resolver = (ctx) =>
        ctx.op === 'update' && ctx.terminalSelect
          ? { data: [{ id: RESERVATION_ID }] }
          : { data: [] };
      const res = await service.cancelReceiptScan(USER, CLIENT_SCAN_ID);
      expect('status' in res && res.status).toBe(RECEIPT_SCAN_STATUS.CANCELLED);
    });

    it('finalizer already won (success row exists) → ALREADY_COMPLETED', async () => {
      db.state.resolver = (ctx) =>
        ctx.op === 'update'
          ? { data: [] }
          : { data: [{ id: RESERVATION_ID, status: RECEIPT_SCAN_STATUS.SUCCESS }] };
      const res = await service.cancelReceiptScan(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.ALREADY_COMPLETED);
    });

    it('already cancelled → idempotent cancelled (not ALREADY_COMPLETED)', async () => {
      db.state.resolver = (ctx) =>
        ctx.op === 'update'
          ? { data: [] }
          : { data: [{ id: RESERVATION_ID, status: RECEIPT_SCAN_STATUS.CANCELLED }] };
      const res = await service.cancelReceiptScan(USER, CLIENT_SCAN_ID);
      expect('status' in res && res.status).toBe(RECEIPT_SCAN_STATUS.CANCELLED);
    });

    it('CAS predicate is pending-only + user-scoped + path-scoped', async () => {
      db.state.resolver = () => ({ data: [{ id: RESERVATION_ID }] });
      await service.cancelReceiptScan(USER, CLIENT_SCAN_ID);
      const cas = db.calls.find((c) => c.op === 'update' && c.terminalSelect);
      expect(cas?.filters.status).toBe(RECEIPT_SCAN_STATUS.PENDING);
      expect(cas?.filters.user_id).toBe(USER.id);
      expect(cas?.filters.storage_path).toBe(`${USER.id}/${CLIENT_SCAN_ID}.webp`);
    });

    it('non-UUID scanId → IMAGE_INVALID', async () => {
      const res = await service.cancelReceiptScan(USER, '../evil');
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.IMAGE_INVALID);
    });
  });

  describe('unreviewedReceiptScans', () => {
    it('returns success+unsaved rows with rehydrated results', async () => {
      db.state.resolver = () => ({
        data: [
          {
            id: RESERVATION_ID,
            storage_path: `${USER.id}/${CLIENT_SCAN_ID}.webp`,
            created_at: '2024-05-12T00:00:00Z',
            extraction_payload: {
              type: 'expense',
              amount: 12.5,
              // A real persisted payload always carries a complete fieldConfidence
              // (six numeric subfields) — payloadToResult rejects a partial one.
              fieldConfidence: {
                amount: 0.9,
                currency: 0.9,
                date: 0.9,
                vendor: 0.9,
                category: 0.9,
                odometer: 0.9,
              },
            },
          },
        ],
      });
      const rows = await service.unreviewedReceiptScans(USER);
      expect(rows).toHaveLength(1);
      expect(rows[0].scanId).toBe(RESERVATION_ID);
      expect(rows[0].result?.amount).toBe(12.5);
      const q = db.calls.find((c) => c.table === 'receipt_scans' && c.op === 'select');
      expect(q?.filters.status).toBe(RECEIPT_SCAN_STATUS.SUCCESS);
      expect(q?.filters.is_saved_at).toBeNull();
    });
  });

  // ===========================================================================
  // U7b — transactional save + undo (KTD-11 / KTD-7)
  // ===========================================================================

  interface ScanRow {
    id: string;
    user_id: string;
    status: string;
    storage_path: string | null;
    saved_at: string | null;
    saved_record_refs: Record<string, unknown> | null;
  }

  const scanRow = (overrides: Partial<ScanRow> = {}): ScanRow => ({
    id: RESERVATION_ID,
    user_id: USER.id,
    status: RECEIPT_SCAN_STATUS.SUCCESS,
    storage_path: STORAGE_PATH,
    saved_at: null,
    saved_record_refs: null,
    ...overrides,
  });

  /** Route receipt_scans reads to `scan`, users reads to `system`, else empty. */
  const routeDb = (scan: ScanRow | null, system = 'metric') => {
    db.state.resolver = (ctx) => {
      if (ctx.table === 'receipt_scans' && ctx.op === 'select') return { data: scan };
      // Atomic claim CAS (saved_at stamp guarded by saved_at IS NULL) succeeds.
      if (
        ctx.table === 'receipt_scans' &&
        ctx.op === 'update' &&
        (ctx.patch as { saved_at?: unknown })?.saved_at != null
      ) {
        return { data: [{ id: RESERVATION_ID }] };
      }
      if (ctx.table === 'users' && ctx.op === 'select') {
        return { data: { measurement_system: system } };
      }
      return { data: [], error: null };
    };
  };

  const saveInput = (overrides: Record<string, unknown> = {}) => ({
    motorcycleId: MOTO_ID,
    type: RECORD_TYPES.EXPENSE,
    amount: 100,
    currency: 'USD',
    date: '2024-05-12',
    vendor: 'Taller Moto',
    itemName: 'Oil change',
    category: 'maintenance',
    partsCost: null,
    laborCost: null,
    applyOdometer: false,
    odometerValue: null,
    odometerUnit: null,
    ...overrides,
  });

  /** The atomic-claim CAS update (stamps saved_at, guarded by saved_at IS NULL). */
  const claimCall = () =>
    db.calls.find(
      (c) =>
        c.table === 'receipt_scans' &&
        c.op === 'update' &&
        (c.patch as { saved_at?: unknown })?.saved_at != null,
    );
  /** The refs-persist update (sets saved_record_refs only, no saved_at). */
  const refsCall = () =>
    db.calls.find(
      (c) =>
        c.table === 'receipt_scans' &&
        c.op === 'update' &&
        (c.patch as { saved_record_refs?: unknown })?.saved_record_refs != null &&
        (c.patch as { saved_at?: unknown })?.saved_at === undefined,
    );
  /** A clearSaved update (releases the claim: saved_at back to null). */
  const clearSavedCall = () =>
    db.calls.find(
      (c) =>
        c.table === 'receipt_scans' &&
        c.op === 'update' &&
        (c.patch as { saved_at?: unknown })?.saved_at === null,
    );

  describe('saveReceiptScan — compensating saga (KTD-11)', () => {
    it('non-UUID scanId → SCAN_NOT_REVIEWABLE (no writes)', async () => {
      routeDb(scanRow());
      const res = await service.saveReceiptScan(USER, '../evil', saveInput());
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
      expect(expensesService.create).not.toHaveBeenCalled();
    });

    it('missing / non-success scan → SCAN_NOT_REVIEWABLE', async () => {
      routeDb(null);
      const res = await service.saveReceiptScan(USER, CLIENT_SCAN_ID, saveInput());
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
    });

    it('motorcycle not owned by caller → SAVE_FAILED, no record written', async () => {
      routeDb(scanRow());
      motorcyclesService.findById.mockResolvedValue(null);
      const res = await service.saveReceiptScan(USER, CLIENT_SCAN_ID, saveInput());
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED);
      expect(expensesService.create).not.toHaveBeenCalled();
      expect(maintenanceTasksService.create).not.toHaveBeenCalled();
    });

    it('expense path writes record + photo + odometer, stamps refs', async () => {
      routeDb(scanRow(), 'metric');
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        saveInput({ applyOdometer: true, odometerValue: 37505, odometerUnit: 'km' }),
      );
      expect('refs' in res).toBe(true);
      if (!('refs' in res)) return;

      expect(expensesService.create).toHaveBeenCalledWith(
        USER.id,
        expect.objectContaining({ motorcycleId: MOTO_ID, amount: 100, category: 'maintenance' }),
      );
      expect(expensesService.addPhoto).toHaveBeenCalledWith(
        USER.id,
        EXPENSE_ID,
        STORAGE_PATH,
        undefined,
        'receipts',
      );
      expect(motorcyclesService.update).toHaveBeenCalledWith(USER.id, MOTO_ID, {
        currentMileage: 37505,
      });

      expect(res.refs.recordType).toBe(RECORD_TYPES.EXPENSE);
      expect(res.refs.expenseId).toBe(EXPENSE_ID);
      expect(res.refs.photoId).toBe(PHOTO_ID);
      expect(res.refs.odometer).toEqual({
        motorcycleId: MOTO_ID,
        previous: 10_000,
        applied: 37505,
      });

      // Atomic claim: CAS on saved_at IS NULL before any record write.
      expect(claimCall()?.filters.is_saved_at).toBeNull();
      // Refs persisted onto the already-claimed row after all steps succeed.
      expect(
        (refsCall()?.patch as { saved_record_refs?: unknown })?.saved_record_refs,
      ).toMatchObject({ expenseId: EXPENSE_ID, photoId: PHOTO_ID });
    });

    it('maintenance path creates completed task w/ source + backs cost out of breakdown', async () => {
      routeDb(scanRow());
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        saveInput({ type: RECORD_TYPES.MAINTENANCE, amount: 200, partsCost: 120, laborCost: 50 }),
      );
      expect('refs' in res).toBe(true);
      expect(maintenanceTasksService.create).toHaveBeenCalledWith(
        USER.id,
        expect.objectContaining({
          status: 'completed',
          source: 'receipt_scan',
          cost: 30, // 200 - 120 - 50 → auto-expense total stays 200
          partsCost: 120,
          laborCost: 50,
        }),
      );
      expect(maintenanceTasksService.addPhoto).toHaveBeenCalledWith(
        USER.id,
        TASK_ID,
        STORAGE_PATH,
        undefined,
        'receipts',
      );
    });

    it('mid-save failure compensates (record soft-deleted, claim released, refs NOT persisted)', async () => {
      routeDb(scanRow());
      expensesService.addPhoto.mockRejectedValueOnce(new Error('storage link failed'));

      const res = await service.saveReceiptScan(USER, CLIENT_SCAN_ID, saveInput());
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED);
      expect(expensesService.softDelete).toHaveBeenCalledWith(USER.id, EXPENSE_ID);
      // Never persisted refs; the claim is rolled back to unsaved for a retry.
      expect(refsCall()).toBeUndefined();
      expect(clearSavedCall()).toBeDefined();
    });

    it('mid-save failure does NOT delete the source receipt object (needed for retry)', async () => {
      routeDb(scanRow());
      // Fail AFTER the photo link succeeds: the odometer WRITE throws mid-saga
      // (findById succeeds for both the ownership assert and the odometer read).
      motorcyclesService.update.mockRejectedValueOnce(new Error('odometer write boom'));
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        saveInput({ applyOdometer: true, odometerValue: 37505, odometerUnit: 'km' }),
      );
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED);
      // The source receipt object must survive the rollback — only the LINK row
      // is removed via the compensation, never the storage object.
      expect(db.remove).not.toHaveBeenCalled();
    });

    it('cost breakdown exceeding the receipt total → SAVE_FAILED (no task created)', async () => {
      routeDb(scanRow());
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        saveInput({ type: RECORD_TYPES.MAINTENANCE, amount: 100, partsCost: 80, laborCost: 50 }),
      );
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SAVE_FAILED);
      expect(maintenanceTasksService.create).not.toHaveBeenCalled();
    });

    it('concurrent save that loses the atomic claim does not double-write', async () => {
      // Scan is loadable + unsaved, but the claim CAS matches 0 rows (another
      // save already won it) and a re-load still shows unsaved → not-reviewable.
      db.state.resolver = (ctx) => {
        if (ctx.table === 'receipt_scans' && ctx.op === 'select') return { data: scanRow() };
        if (
          ctx.table === 'receipt_scans' &&
          ctx.op === 'update' &&
          (ctx.patch as { saved_at?: unknown })?.saved_at != null
        ) {
          return { data: [] }; // claim lost
        }
        return { data: [], error: null };
      };
      const res = await service.saveReceiptScan(USER, CLIENT_SCAN_ID, saveInput());
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
      expect(expensesService.create).not.toHaveBeenCalled();
    });

    it('idempotent when already saved — returns existing refs, no re-write', async () => {
      routeDb(
        scanRow({
          saved_at: '2024-05-12T10:00:00Z',
          saved_record_refs: { recordType: RECORD_TYPES.EXPENSE, expenseId: EXPENSE_ID },
        }),
      );
      const res = await service.saveReceiptScan(USER, CLIENT_SCAN_ID, saveInput());
      expect('refs' in res && res.refs.expenseId).toBe(EXPENSE_ID);
      expect(expensesService.create).not.toHaveBeenCalled();
      expect(claimCall()).toBeUndefined();
      expect(refsCall()).toBeUndefined();
    });
  });

  describe('saveReceiptScan — odometer conversion + guards (KTD-7)', () => {
    const odoInput = (overrides: Record<string, unknown>) =>
      saveInput({ applyOdometer: true, ...overrides });

    it('metric owner, km-printed → written unchanged', async () => {
      motorcyclesService.findById.mockResolvedValue({ id: MOTO_ID, currentMileage: null });
      routeDb(scanRow(), 'metric');
      await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        odoInput({ odometerValue: 37505, odometerUnit: 'km' }),
      );
      expect(motorcyclesService.update).toHaveBeenCalledWith(USER.id, MOTO_ID, {
        currentMileage: 37505,
      });
    });

    it('imperial owner, miles-printed → written unchanged (KTD-7 pair)', async () => {
      motorcyclesService.findById.mockResolvedValue({ id: MOTO_ID, currentMileage: null });
      routeDb(scanRow(), 'imperial');
      await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        odoInput({ odometerValue: 23000, odometerUnit: 'mi' }),
      );
      expect(motorcyclesService.update).toHaveBeenCalledWith(USER.id, MOTO_ID, {
        currentMileage: 23000,
      });
    });

    it('imperial owner, km-printed → converted to miles (KTD-7 pair)', async () => {
      motorcyclesService.findById.mockResolvedValue({ id: MOTO_ID, currentMileage: null });
      routeDb(scanRow(), 'imperial');
      await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        odoInput({ odometerValue: 37015, odometerUnit: 'km' }),
      );
      // round(kmToMiles(37015)) = round(23000.06) = 23000
      expect(motorcyclesService.update).toHaveBeenCalledWith(USER.id, MOTO_ID, {
        currentMileage: 23000,
      });
    });

    it('null current_mileage → first-set accepted (previous=null)', async () => {
      motorcyclesService.findById.mockResolvedValue({ id: MOTO_ID, currentMileage: null });
      routeDb(scanRow(), 'metric');
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        odoInput({ odometerValue: 5000, odometerUnit: 'km' }),
      );
      expect('refs' in res && res.refs.odometer).toEqual({
        motorcycleId: MOTO_ID,
        previous: null,
        applied: 5000,
      });
    });

    it('decrease is skipped (never write a lower odometer)', async () => {
      motorcyclesService.findById.mockResolvedValue({ id: MOTO_ID, currentMileage: 40_000 });
      routeDb(scanRow(), 'metric');
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        odoInput({ odometerValue: 30_000, odometerUnit: 'km' }),
      );
      expect(motorcyclesService.update).not.toHaveBeenCalled();
      expect('refs' in res && res.refs.odometer).toBeUndefined();
    });

    it('implausible jump is skipped + flagged (not failed)', async () => {
      motorcyclesService.findById.mockResolvedValue({ id: MOTO_ID, currentMileage: 10_000 });
      routeDb(scanRow(), 'metric');
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        odoInput({ odometerValue: 5_000_000, odometerUnit: 'km' }),
      );
      expect('refs' in res).toBe(true); // save still succeeds
      expect(motorcyclesService.update).not.toHaveBeenCalled();
    });

    it('applyOdometer without a printed unit is skipped — never assumed (KTD-7)', async () => {
      motorcyclesService.findById.mockResolvedValue({ id: MOTO_ID, currentMileage: null });
      routeDb(scanRow(), 'metric');
      const res = await service.saveReceiptScan(
        USER,
        CLIENT_SCAN_ID,
        odoInput({ odometerValue: 37505, odometerUnit: null }),
      );
      expect('refs' in res).toBe(true); // save still succeeds
      expect(motorcyclesService.update).not.toHaveBeenCalled();
      expect('refs' in res && res.refs.odometer).toBeUndefined();
    });
  });

  describe('undoReceiptScanSave — reverse + guarded revert (KTD-11)', () => {
    const savedExpenseRefs = {
      recordType: RECORD_TYPES.EXPENSE,
      expenseId: EXPENSE_ID,
      photoId: PHOTO_ID,
      odometer: { motorcycleId: MOTO_ID, previous: 9000, applied: 10_000 },
    };

    it('reverses expense + storage object + guarded odometer, returns REVERTED', async () => {
      routeDb(scanRow({ saved_at: '2024-05-12T10:00:00Z', saved_record_refs: savedExpenseRefs }));
      const res = await service.undoReceiptScanSave(USER, CLIENT_SCAN_ID);
      expect('status' in res && res.status).toBe(UNDO_STATUS.REVERTED);

      expect(expensesService.softDelete).toHaveBeenCalledWith(USER.id, EXPENSE_ID);
      expect(db.remove).toHaveBeenCalledWith([STORAGE_PATH]);

      // Guarded revert: CAS on current_mileage = applied, restoring previous.
      const revert = db.calls.find((c) => c.table === 'motorcycles' && c.op === 'update');
      expect(revert?.filters.current_mileage).toBe(10_000); // predicate
      expect((revert?.patch as { current_mileage?: unknown })?.current_mileage).toBe(9000);

      // Cleared back to success-unreviewed.
      const cleared = db.calls.find(
        (c) =>
          c.table === 'receipt_scans' &&
          c.op === 'update' &&
          (c.patch as { saved_at?: unknown; saved_record_refs?: unknown })?.saved_at === null,
      );
      expect(cleared).toBeDefined();
    });

    it('maintenance undo also soft-deletes the linked auto-expense', async () => {
      db.state.resolver = (ctx) => {
        if (ctx.table === 'receipt_scans' && ctx.op === 'select') {
          return {
            data: scanRow({
              saved_at: '2024-05-12T10:00:00Z',
              saved_record_refs: { recordType: RECORD_TYPES.MAINTENANCE, taskId: TASK_ID },
            }),
          };
        }
        // The auto-expense linked to the task.
        if (ctx.table === 'expenses' && ctx.op === 'select') return { data: [{ id: EXPENSE_ID }] };
        return { data: [], error: null };
      };
      const res = await service.undoReceiptScanSave(USER, CLIENT_SCAN_ID);
      expect('status' in res && res.status).toBe(UNDO_STATUS.REVERTED);
      expect(expensesService.softDelete).toHaveBeenCalledWith(USER.id, EXPENSE_ID);
      expect(maintenanceTasksService.softDelete).toHaveBeenCalledWith(USER.id, TASK_ID);
    });

    it('a failed reversal leaves the ref uncleared (resumable) → UNDO_FAILED, saved_at kept', async () => {
      routeDb(scanRow({ saved_at: '2024-05-12T10:00:00Z', saved_record_refs: savedExpenseRefs }));
      // The expense soft-delete fails → its ref must NOT be cleared and the scan
      // must NOT be marked fully undone, so a re-run can retry the leftover.
      expensesService.softDelete.mockRejectedValueOnce(new Error('transient'));

      const res = await service.undoReceiptScanSave(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.UNDO_FAILED);
      // saved_at is not cleared (no clearSaved with saved_at === null).
      const clearedSaved = db.calls.find(
        (c) =>
          c.table === 'receipt_scans' &&
          c.op === 'update' &&
          (c.patch as { saved_at?: unknown; saved_record_refs?: unknown })?.saved_at === null &&
          (c.patch as { saved_record_refs?: unknown })?.saved_record_refs === null,
      );
      expect(clearedSaved).toBeUndefined();
    });

    it('nothing to undo → NOTHING_TO_UNDO (idempotent, double-undo safe)', async () => {
      routeDb(scanRow({ saved_at: null, saved_record_refs: null }));
      const res = await service.undoReceiptScanSave(USER, CLIENT_SCAN_ID);
      expect('status' in res && res.status).toBe(UNDO_STATUS.NOTHING_TO_UNDO);
      expect(expensesService.softDelete).not.toHaveBeenCalled();
    });

    it('unknown / foreign scan → SCAN_NOT_REVIEWABLE', async () => {
      routeDb(null);
      const res = await service.undoReceiptScanSave(USER, CLIENT_SCAN_ID);
      expect('code' in res && res.code).toBe(RECEIPT_SCAN_ERROR_CODES.SCAN_NOT_REVIEWABLE);
    });
  });
});
