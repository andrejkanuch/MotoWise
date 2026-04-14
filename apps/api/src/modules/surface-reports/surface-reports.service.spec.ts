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

function createMockRedis() {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  };
}

describe('SurfaceReportsService', () => {
  let service: SurfaceReportsService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockRedis = createMockRedis();
    service = new SurfaceReportsService(mockSupabase.client as never, mockRedis as never);
  });

  describe('reportSurface', () => {
    it('creates a surface report successfully', async () => {
      const reportRow = {
        id: 'report-1',
        route_id: 'route-1',
        user_id: 'user-1',
        condition: 'wet',
        note: 'Slippery after rain',
        photo_url: null,
        reported_at: '2026-04-13T10:00:00Z',
      };

      // insert -> select -> single chain
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: reportRow, error: null }),
      };

      mockSupabase.client.from = vi.fn().mockReturnValue(insertChain);

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

    it('rejects when insert fails', async () => {
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value violates unique constraint' },
        }),
      };

      mockSupabase.client.from = vi.fn().mockReturnValue(insertChain);

      await expect(
        service.reportSurface('user-1', {
          routeId: 'route-1',
          condition: 'wet',
        }),
      ).rejects.toThrow('duplicate key value violates unique constraint');
    });
  });

  describe('routeConditions', () => {
    it('returns aggregated conditions', async () => {
      const recentRows = [
        {
          id: 'r1',
          route_id: 'route-1',
          user_id: 'u1',
          condition: 'wet',
          note: null,
          photo_url: null,
          reported_at: '2026-04-13T10:00:00Z',
        },
        {
          id: 'r2',
          route_id: 'route-1',
          user_id: 'u2',
          condition: 'wet',
          note: null,
          photo_url: null,
          reported_at: '2026-04-12T08:00:00Z',
        },
        {
          id: 'r3',
          route_id: 'route-1',
          user_id: 'u3',
          condition: 'gravel',
          note: null,
          photo_url: null,
          reported_at: '2026-04-11T14:00:00Z',
        },
        {
          id: 'r4',
          route_id: 'route-1',
          user_id: 'u4',
          condition: 'dry',
          note: null,
          photo_url: null,
          reported_at: '2026-04-10T09:00:00Z',
        },
      ];

      const aggregateRows = [
        { condition: 'wet' },
        { condition: 'wet' },
        { condition: 'gravel' },
        { condition: 'dry' },
      ];

      let callCount = 0;
      mockSupabase.client.from = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // getRecentReports: select -> eq -> order -> limit
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: recentRows, error: null }),
                }),
              }),
            }),
          };
        }
        // getAggregates: select -> eq -> gte
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({ data: aggregateRows, error: null }),
            }),
          }),
        };
      });

      const result = await service.routeConditions('route-1');

      expect(result.recentReports).toHaveLength(4);
      expect(result.recentReports[0].routeId).toBe('route-1');

      expect(result.aggregates).toHaveLength(3);

      const wet = result.aggregates.find((a) => a.condition === 'wet');
      expect(wet).toBeDefined();
      expect(wet?.count).toBe(2);

      const gravel = result.aggregates.find((a) => a.condition === 'gravel');
      expect(gravel).toBeDefined();
      expect(gravel?.count).toBe(1);

      const dry = result.aggregates.find((a) => a.condition === 'dry');
      expect(dry).toBeDefined();
      expect(dry?.count).toBe(1);
    });

    it('returns empty array when no reports exist', async () => {
      mockSupabase.client.from = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }));

      const result = await service.routeConditions('route-1');
      expect(result.recentReports).toEqual([]);
      expect(result.aggregates).toEqual([]);
    });
  });
});
