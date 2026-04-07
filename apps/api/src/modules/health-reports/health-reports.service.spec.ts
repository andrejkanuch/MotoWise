import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthReportsService } from './health-reports.service';

describe('HealthReportsService', () => {
  let service: HealthReportsService;
  let mockUserClient: ReturnType<typeof createMockClient>;
  let mockAdminClient: ReturnType<typeof createMockClient>;

  const userId = 'user-hr-1111-2222-3333-4444aaaabbbb';
  const bikeId = 'bike-hr-aaaa-bbbb-cccc-dddd1111eeee';

  const fakeBike = {
    id: bikeId,
    make: 'Kawasaki',
    model: 'Z900',
    year: 2025,
    nickname: 'Ninja',
    current_mileage: 12500,
    mileage_unit: 'km',
  };

  const fakePendingReport = {
    id: 'report-1234-5678-9012-3456abcdefgh',
    user_id: userId,
    bike_id: bikeId,
    status: 'pending',
    pdf_signed_url: null,
    pdf_storage_path: null,
    iap_transaction_id: 'txn-apple-12345',
    purchased_at: '2026-04-07T08:00:00Z',
    download_expires_at: null,
  };

  const fakeCompletedReport = {
    ...fakePendingReport,
    status: 'completed',
    pdf_signed_url: 'https://storage.supabase.co/signed/reports/user/bike/1234.pdf',
    pdf_storage_path: `${userId}/${bikeId}/1234.pdf`,
    download_expires_at: '2026-04-08T08:00:00Z',
  };

  function createChain() {
    const results: Array<{ data?: unknown; error?: unknown; count?: unknown }> = [];
    let callIndex = 0;

    const getResult = () => {
      const r = results[callIndex] ?? { data: null, error: null };
      callIndex++;
      return { data: null, error: null, ...r };
    };

    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'insert',
      'update',
      'delete',
      'upsert',
      'eq',
      'in',
      'is',
      'lt',
      'not',
      'gte',
      'order',
      'limit',
      'maybeSingle',
    ]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
    // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable
    chain.then = vi
      .fn()
      .mockImplementation((resolve: (v: unknown) => void) => resolve(getResult()));

    return {
      chain: chain as Record<string, ReturnType<typeof vi.fn>>,
      pushResult: (r: { data?: unknown; error?: unknown; count?: unknown }) => results.push(r),
      resetIndex: () => {
        callIndex = 0;
      },
    };
  }

  function createMockClient() {
    const { chain, pushResult, resetIndex } = createChain();

    return {
      from: vi.fn().mockReturnValue(chain),
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi
            .fn()
            .mockResolvedValue({
              data: { signedUrl: 'https://storage.supabase.co/signed/reports/new.pdf' },
              error: null,
            }),
        }),
      },
      _chain: chain,
      _pushResult: pushResult,
      _resetIndex: resetIndex,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClient = createMockClient();
    mockAdminClient = createMockClient();

    service = new HealthReportsService(mockUserClient as never, mockAdminClient as never);
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    // Mock renderPdf to avoid requiring @react-pdf/renderer in tests
    // biome-ignore lint/suspicious/noExplicitAny: mocking private method for test isolation
    (service as any).renderPdf = vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content'));
  });

  describe('generateReport', () => {
    it('should generate a report for a bike with a pending purchase', async () => {
      // User client: bike ownership check (.single())
      mockUserClient._pushResult({ data: fakeBike });

      // Admin client result 0: find pending report (.single() via maybeSingle)
      mockAdminClient._pushResult({ data: fakePendingReport });

      // Admin client result 1: maintenance_tasks query (thenable)
      mockAdminClient._pushResult({
        data: [
          {
            title: 'Oil Change',
            status: 'pending',
            priority: 'high',
            due_date: '2026-04-15',
            completed_at: null,
          },
        ],
      });

      // Admin client result 2: expenses query (thenable)
      mockAdminClient._pushResult({
        data: [{ amount: 45.5 }, { amount: 120.0 }],
      });

      // Admin client result 3: update report as completed (.single())
      mockAdminClient._pushResult({ data: fakeCompletedReport });

      const result = await service.generateReport(userId, bikeId);

      expect(result.id).toBe(fakePendingReport.id);
      expect(result.userId).toBe(userId);
      expect(result.motorcycleId).toBe(bikeId);
      expect(result.status).toBe('completed');
      expect(result.pdfUrl).toBeDefined();
    });

    it('should throw ForbiddenException when no pending purchase exists', async () => {
      // User client: bike ownership check
      mockUserClient._pushResult({ data: fakeBike });
      // Admin client: no pending report found
      mockAdminClient._pushResult({ data: null });

      await expect(service.generateReport(userId, bikeId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when bike not owned by user', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.generateReport(userId, bikeId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyReports', () => {
    it('should return mapped reports list', async () => {
      mockUserClient._pushResult({
        data: [fakeCompletedReport, { ...fakePendingReport, id: 'report-pending-2' }],
      });

      const result = await service.getMyReports(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(fakeCompletedReport.id);
      expect(result[0].status).toBe('completed');
      expect(result[0].pdfUrl).toBeDefined();
      expect(result[1].status).toBe('pending');
    });

    it('should return empty list when no reports', async () => {
      mockUserClient._pushResult({ data: [] });

      const result = await service.getMyReports(userId);

      expect(result).toHaveLength(0);
    });

    it('should throw InternalServerErrorException on DB error', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Connection error', code: '08006' },
      });

      await expect(service.getMyReports(userId)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
