import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurfaceReportsService } from './surface-reports.service';

/** Helper to build a mock Supabase client with chainable query builder */
function createMockSupabase() {
  const queryBuilder: Record<string, ReturnType<typeof vi.fn>> = {};

  const chain = () =>
    new Proxy(queryBuilder, {
      get(target, prop: string) {
        if (!(prop in target)) {
          target[prop] = vi.fn().mockReturnValue(chain());
        }
        return target[prop];
      },
    });

  const client = {
    from: vi.fn().mockReturnValue(chain()),
  };

  return { client, queryBuilder };
}

describe('SurfaceReportsService', () => {
  let service: SurfaceReportsService;
  let mockUser: ReturnType<typeof createMockSupabase>;
  let mockAdmin: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockUser = createMockSupabase();
    mockAdmin = createMockSupabase();
    service = new SurfaceReportsService(mockUser.client as never, mockAdmin.client as never);
  });

  describe('reportSurface', () => {
    it('creates a surface report successfully', async () => {
      const reportRow = {
        id: 'report-1',
        route_id: 'route-1',
        user_id: 'user-1',
        condition: 'wet',
        note: 'Slippery after rain',
        reported_at: '2026-04-13T10:00:00Z',
      };

      // First call: duplicate check -- no existing report
      const dupChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Second call: insert
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: reportRow, error: null }),
      };

      let callCount = 0;
      mockUser.client.from = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? dupChain : insertChain;
      });

      const result = await service.reportSurface('user-1', {
        routeId: 'route-1',
        condition: 'wet',
        note: 'Slippery after rain',
      });

      expect(result.id).toBe('report-1');
      expect(result.routeId).toBe('route-1');
      expect(result.condition).toBe('wet');
      expect(result.note).toBe('Slippery after rain');
    });

    it('rejects duplicate report on the same day', async () => {
      const dupChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'existing-report' },
          error: null,
        }),
      };

      mockUser.client.from = vi.fn().mockReturnValue(dupChain);

      await expect(
        service.reportSurface('user-1', {
          routeId: 'route-1',
          condition: 'wet',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('routeConditions', () => {
    it('returns aggregated conditions', async () => {
      const rows = [
        { condition: 'wet', reported_at: '2026-04-13T10:00:00Z' },
        { condition: 'wet', reported_at: '2026-04-12T08:00:00Z' },
        { condition: 'gravel', reported_at: '2026-04-11T14:00:00Z' },
        { condition: 'dry', reported_at: '2026-04-10T09:00:00Z' },
      ];

      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      };

      mockAdmin.client.from = vi.fn().mockReturnValue(selectChain);

      const result = await service.routeConditions('route-1');

      expect(result).toHaveLength(3);

      const wet = result.find((r) => r.condition === 'wet');
      expect(wet).toBeDefined();
      expect(wet?.count).toBe(2);
      expect(wet?.latestReportedAt).toBe('2026-04-13T10:00:00Z');

      const gravel = result.find((r) => r.condition === 'gravel');
      expect(gravel).toBeDefined();
      expect(gravel?.count).toBe(1);

      const dry = result.find((r) => r.condition === 'dry');
      expect(dry).toBeDefined();
      expect(dry?.count).toBe(1);
    });

    it('returns empty array when no reports exist', async () => {
      const selectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      mockAdmin.client.from = vi.fn().mockReturnValue(selectChain);

      const result = await service.routeConditions('route-1');
      expect(result).toEqual([]);
    });
  });
});
