import { FREE_TIER_LIMITS } from '@motovault/types';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
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
    it('should return mapped motorcycles with camelCase fields', async () => {
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [sampleRow], error: null }),
            }),
          }),
        }),
      });

      const result = await service.findByUser('user-1');

      expect(result).toEqual([expectedMapped]);
    });

    it('should throw InternalServerErrorException on query error', async () => {
      (mockUserClient.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error', code: '42P01' },
              }),
            }),
          }),
        }),
      });

      await expect(service.findByUser('user-1')).rejects.toThrow(InternalServerErrorException);
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
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
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
          eq: vi.fn().mockResolvedValue({ count: FREE_TIER_LIMITS.MAX_BIKES, error: null }),
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
          eq: vi.fn().mockResolvedValue({ count: null, error: { message: 'DB down' } }),
        }),
      });

      // Should throw — fails closed to prevent free-tier bypass
      await expect(
        service.create('user-1', { make: 'Honda', model: 'CB500F', year: 2023 }),
      ).rejects.toThrow('Unable to verify bike limit');
    });
  });
});
