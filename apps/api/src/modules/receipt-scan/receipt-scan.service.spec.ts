import type { ReceiptExtraction } from '@motovault/types';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { AiBudgetService } from '../ai-budget/ai-budget.service';
import { RECEIPT_SCAN_ERROR_CODES, RECEIPT_SCAN_STATUS } from './receipt-scan.constants';
import { ReceiptScanService } from './receipt-scan.service';
import type { ReceiptScanAiService } from './receipt-scan-ai.service';

const RESERVATION_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_SCAN_ID = '22222222-2222-4222-8222-222222222222';

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
  op: 'select' | 'update';
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
    resolver: () => ({ data: [], count: 0, error: null }),
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
      order() {
        return builder;
      },
      limit() {
        return builder;
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

  const db = {
    from: (t: string) => makeBuilder(t),
    rpc,
    download,
    storage: { from: () => ({ download }) },
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
            extraction_payload: { type: 'expense', fieldConfidence: {}, amount: 12.5 },
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
});
