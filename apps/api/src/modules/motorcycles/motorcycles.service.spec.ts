import { FREE_TIER_LIMITS } from '@motovault/types';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotorcyclesService } from './motorcycles.service';

describe('MotorcyclesService', () => {
  let service: MotorcyclesService;
  let mockUserClient: Record<string, unknown>;
  let mockAdminClient: Record<string, unknown>;

  const sampleRow = {
    id: 'moto-1',
    user_id: 'user-1',
    make: 'Honda',
    model: 'CB500F',
    year: 2023,
    nickname: 'My Honda',
    is_primary: true,
    primary_photo_url: 'https://example.com/photo.jpg',
    current_mileage: 5000,
    mileage_unit: 'km',
    distance_unit: 'km',
    mileage_updated_at: '2024-06-01T00:00:00Z',
    type: 'sport',
    engine_cc: 471,
    created_at: '2024-01-01T00:00:00Z',
  };

  const expectedMapped = {
    id: 'moto-1',
    userId: 'user-1',
    make: 'Honda',
    model: 'CB500F',
    year: 2023,
    nickname: 'My Honda',
    isPrimary: true,
    primaryPhotoUrl: 'https://example.com/photo.jpg',
    currentMileage: 5000,
    mileageUnit: 'km',
    distanceUnit: 'km',
    mileageUpdatedAt: '2024-06-01T00:00:00Z',
    type: 'sport',
    engineCc: 471,
    createdAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClient = { from: vi.fn(), rpc: vi.fn() };
    mockAdminClient = { from: vi.fn() };
    service = new MotorcyclesService(mockUserClient as never, mockAdminClient as never);
  });

  describe('findByUser', () => {
    it('should return mapped motorcycles with camelCase fields (excluding soft-deleted)', async () => {
      const isMock = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [sampleRow], error: null }),
        }),
      });
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ is: isMock }),
        }),
      });

      const result = await service.findByUser('user-1');

      // Garage list must filter out soft-deleted bikes (deleted_at IS NULL)
      expect(isMock).toHaveBeenCalledWith('deleted_at', null);
      expect(result).toEqual([expectedMapped]);
    });

    it('maps distance_unit to distanceUnit and selects the column', async () => {
      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                // The deprecated mileage_unit disagrees on purpose: it must not leak in.
                data: [{ ...sampleRow, mileage_unit: 'km', distance_unit: 'mi' }],
                error: null,
              }),
            }),
          }),
        }),
      });
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({ select: selectMock });

      const [bike] = await service.findByUser('user-1');

      expect(bike.distanceUnit).toBe('mi');
      expect(selectMock).toHaveBeenCalledWith(expect.stringContaining('distance_unit'));
    });

    it('should throw InternalServerErrorException on query error', async () => {
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'DB error', code: '42P01' },
                }),
              }),
            }),
          }),
        }),
      });

      await expect(service.findByUser('user-1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findById', () => {
    it('returns the mapped motorcycle when found', async () => {
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: sampleRow, error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await service.findById('user-1', 'moto-1');

      expect(result).toEqual(expectedMapped);
    });

    it('returns null when no row matches (not found / not owned / deleted)', async () => {
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await service.findById('user-1', 'missing');

      expect(result).toBeNull();
    });

    it('throws InternalServerErrorException on query error', async () => {
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: { message: 'DB error', code: '42P01' } }),
              }),
            }),
          }),
        }),
      });

      await expect(service.findById('user-1', 'moto-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('create', () => {
    it('should insert and return mapped result', async () => {
      // Mock enforceFreeTierBikeLimit (admin user lookup + count)
      (mockAdminClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { subscription_tier: 'pro' }, error: null }),
          }),
        }),
      });

      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: sampleRow, error: null }),
          }),
        }),
      });

      const result = await service.create('user-1', {
        make: 'Honda',
        model: 'CB500F',
        year: 2023,
      });

      expect(result).toEqual(expectedMapped);
    });

    it('should call enforceFreeTierBikeLimit before inserting', async () => {
      const adminFromSpy = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { subscription_tier: 'free' },
              error: null,
            }),
          }),
        }),
      });
      (mockAdminClient.from as ReturnType<typeof vi.fn>).mockImplementation(adminFromSpy);

      // Count returns 0 (under limit)
      const userFromSpy = vi.fn();
      // First call: enforceFreeTierBikeLimit count query
      userFromSpy.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      });
      // Second call: insert
      userFromSpy.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: sampleRow, error: null }),
          }),
        }),
      });
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockImplementation(userFromSpy);

      await service.create('user-1', { make: 'Honda', model: 'CB500F', year: 2023 });

      // Admin client was called for tier lookup before insert
      expect(adminFromSpy).toHaveBeenCalledWith('users');
    });
  });

  describe('update', () => {
    it('should build partial update and scope by user_id', async () => {
      const eqMock = vi.fn();
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: eqMock.mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: sampleRow, error: null }),
            }),
          }),
        }),
      });
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: updateMock,
      });

      const result = await service.update('user-1', 'moto-1', {
        nickname: 'Speedy',
        isPrimary: true,
      });

      expect(updateMock).toHaveBeenCalledWith({ nickname: 'Speedy', is_primary: true });
      expect(result).toEqual(expectedMapped);
    });
  });

  describe('softDelete', () => {
    it('should call RPC and return true on success', async () => {
      (mockUserClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: true,
        error: null,
      });

      const result = await service.softDelete('user-1', 'moto-1');

      expect(result).toBe(true);
      expect(mockUserClient.rpc).toHaveBeenCalledWith('soft_delete_motorcycle', {
        motorcycle_id: 'moto-1',
      });
    });

    it('should throw BadRequestException when RPC returns false', async () => {
      (mockUserClient.rpc as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: false,
        error: null,
      });

      await expect(service.softDelete('user-1', 'moto-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enforceFreeTierBikeLimit', () => {
    it('should throw ForbiddenException when at limit', async () => {
      (mockAdminClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { subscription_tier: 'free' },
              error: null,
            }),
          }),
        }),
      });

      const userFromSpy = vi.fn();
      // Count query returns the limit
      userFromSpy.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: FREE_TIER_LIMITS.MAX_BIKES, error: null }),
          }),
        }),
      });
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockImplementation(userFromSpy);

      // Trigger enforceFreeTierBikeLimit via create
      await expect(
        service.create('user-1', { make: 'Honda', model: 'CB500F', year: 2023 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should fail closed on DB count error (throws InternalServerErrorException)', async () => {
      (mockAdminClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { subscription_tier: 'free' },
              error: null,
            }),
          }),
        }),
      });

      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: null, error: { message: 'DB down' } }),
          }),
        }),
      });

      // Should throw — fails closed to prevent free-tier bypass
      await expect(
        service.create('user-1', { make: 'Honda', model: 'CB500F', year: 2023 }),
      ).rejects.toThrow('Unable to verify bike limit');
    });
  });

  // getMakeStats moved to MakeStatsService (singleton) — see make-stats.service.spec.ts

  describe('recalls + acknowledgements (00189)', () => {
    type Result = { data?: unknown; error?: { message: string; code?: string } | null };

    /** A PostgREST-style builder: every call returns itself, awaiting resolves `result`. */
    function chain(result: Result) {
      const calls: Array<[string, unknown[]]> = [];
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'single', 'insert', 'delete', 'update']) {
        builder[method] = vi.fn((...args: unknown[]) => {
          calls.push([method, args]);
          return builder;
        });
      }
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub — Supabase query builders are awaited directly.
      builder.then = (resolve: (value: Result) => unknown) =>
        resolve({ data: null, error: null, ...result });
      return { builder, calls };
    }

    const bikeRow = { ...sampleRow, vin: null, recall_count: 2 };
    const recallA = {
      campaignNumber: '23V100000',
      reportDate: '2023-01-01',
      component: 'BRAKES',
      summary: 's',
      consequence: 'c',
      remedy: 'r',
    };
    const recallB = { ...recallA, campaignNumber: '24V200000', component: 'FUEL' };
    const recallC = { ...recallA, campaignNumber: '25V300000', component: 'LIGHTS' };

    let nhtsa: { getRecalls: ReturnType<typeof vi.fn> };
    let tables: Record<string, Array<ReturnType<typeof chain>>>;
    let adminUpdate: ReturnType<typeof chain>;

    /** Queue builders per table, consumed in call order. */
    function wireUserClient(acks: Result, write?: Result) {
      tables = {
        motorcycles: [chain({ data: bikeRow })],
        recall_acknowledgements: write ? [chain(write), chain(acks)] : [chain(acks)],
      };
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
        const next = tables[table]?.shift();
        if (!next) throw new Error(`unexpected from(${table})`);
        return next.builder;
      });
    }

    beforeEach(() => {
      nhtsa = { getRecalls: vi.fn().mockResolvedValue([recallA, recallB, recallC]) };
      service = new MotorcyclesService(
        mockUserClient as never,
        mockAdminClient as never,
        nhtsa as never,
      );
      adminUpdate = chain({ data: null });
      (mockAdminClient.from as ReturnType<typeof vi.fn>).mockReturnValue(adminUpdate.builder);
    });

    it('checkRecalls marks acknowledged recalls, lists open first and persists the OPEN count', async () => {
      wireUserClient({
        data: [
          { campaign_number: '23V100000', acknowledged_at: '2026-01-01T00:00:00Z' },
          { campaign_number: '25V300000', acknowledged_at: '2026-02-01T00:00:00Z' },
        ],
      });

      const result = await service.checkRecalls('user-1', 'moto-1');

      expect(result.count).toBe(1);
      expect(result.acknowledgedCount).toBe(2);
      expect(result.recalls.map((r) => r.campaignNumber)).toEqual([
        '24V200000', // open
        '25V300000', // acknowledged, most recent first
        '23V100000',
      ]);
      expect(result.recalls[0]).toMatchObject({ acknowledged: false, acknowledgedAt: null });
      expect(result.recalls[1]).toMatchObject({
        acknowledged: true,
        acknowledgedAt: '2026-02-01T00:00:00Z',
      });
      expect(adminUpdate.builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ recall_count: 1 }),
      );
      // Admin write stays scoped to the owned, live bike.
      expect(adminUpdate.calls).toEqual(
        expect.arrayContaining([
          ['eq', ['id', 'moto-1']],
          ['eq', ['user_id', 'user-1']],
          ['is', ['deleted_at', null]],
        ]),
      );
    });

    it('checkRecalls reads acknowledgements through the USER client, scoped to the rider and bike', async () => {
      wireUserClient({ data: [] });
      const acks = tables.recall_acknowledgements[0];

      const result = await service.checkRecalls('user-1', 'moto-1');

      expect(result.count).toBe(3);
      expect(acks.calls).toEqual(
        expect.arrayContaining([
          ['eq', ['user_id', 'user-1']],
          ['eq', ['motorcycle_id', 'moto-1']],
        ]),
      );
      expect(mockAdminClient.from).not.toHaveBeenCalledWith('recall_acknowledgements');
    });

    it('checkRecalls fails instead of counting dismissed recalls as open when the read fails', async () => {
      wireUserClient({ data: null, error: { message: 'boom', code: '42P01' } });

      await expect(service.checkRecalls('user-1', 'moto-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(adminUpdate.builder.update).not.toHaveBeenCalled();
    });

    it("checkRecalls 404s for a bike that is not the caller's", async () => {
      tables = {
        motorcycles: [chain({ data: null, error: { message: 'none', code: 'PGRST116' } })],
      };
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockImplementation(
        (table: string) => tables[table].shift()?.builder,
      );

      await expect(service.checkRecalls('user-2', 'moto-1')).rejects.toThrow(NotFoundException);
      expect(nhtsa.getRecalls).not.toHaveBeenCalled();
    });

    it('acknowledgeRecall inserts via the user client and returns the recomputed result', async () => {
      wireUserClient(
        { data: [{ campaign_number: '24V200000', acknowledged_at: '2026-03-01T00:00:00Z' }] },
        { data: null },
      );
      const insert = tables.recall_acknowledgements[0];

      const result = await service.acknowledgeRecall('user-1', 'moto-1', '24V200000');

      expect(insert.builder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        motorcycle_id: 'moto-1',
        campaign_number: '24V200000',
      });
      expect(result.count).toBe(2);
      expect(result.acknowledgedCount).toBe(1);
      expect(adminUpdate.builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ recall_count: 2 }),
      );
    });

    it('acknowledgeRecall is idempotent: a unique violation is a no-op', async () => {
      wireUserClient(
        { data: [{ campaign_number: '24V200000', acknowledged_at: '2026-03-01T00:00:00Z' }] },
        { error: { message: 'duplicate key', code: '23505' } },
      );

      const result = await service.acknowledgeRecall('user-1', 'moto-1', '24V200000');

      expect(result.acknowledgedCount).toBe(1);
    });

    it('acknowledgeRecall rejects a campaign NHTSA does not list for the bike', async () => {
      wireUserClient({ data: [] });

      await expect(service.acknowledgeRecall('user-1', 'moto-1', '99V999999')).rejects.toThrow(
        BadRequestException,
      );
      expect(tables.recall_acknowledgements).toHaveLength(1); // nothing written or read
    });

    it('acknowledgeRecall maps an RLS rejection to NotFound', async () => {
      wireUserClient({ data: [] }, { error: { message: 'rls', code: '42501' } });

      await expect(service.acknowledgeRecall('user-1', 'moto-1', '24V200000')).rejects.toThrow(
        NotFoundException,
      );
      expect(adminUpdate.builder.update).not.toHaveBeenCalled();
    });

    it("unacknowledgeRecall hard-deletes the rider's row and returns the recomputed result", async () => {
      wireUserClient({ data: [] }, { data: null });
      const del = tables.recall_acknowledgements[0];

      const result = await service.unacknowledgeRecall('user-1', 'moto-1', '24V200000');

      expect(del.builder.delete).toHaveBeenCalled();
      expect(del.calls).toEqual(
        expect.arrayContaining([
          ['eq', ['user_id', 'user-1']],
          ['eq', ['motorcycle_id', 'moto-1']],
          ['eq', ['campaign_number', '24V200000']],
        ]),
      );
      expect(result.count).toBe(3);
      expect(result.acknowledgedCount).toBe(0);
    });

    it('unacknowledgeRecall surfaces a delete failure', async () => {
      wireUserClient({ data: [] }, { error: { message: 'boom', code: 'XX000' } });

      await expect(service.unacknowledgeRecall('user-1', 'moto-1', '24V200000')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
