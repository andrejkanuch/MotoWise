import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataExportService } from './data-export.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserClient: ReturnType<typeof createMockClient>;
  let mockDataExportService: { requestDataExport: ReturnType<typeof vi.fn> };
  let mockRevenueCatService: { cancelSubscription: ReturnType<typeof vi.fn> };
  let mockEmailService: { sendAccountDeletionConfirmation: ReturnType<typeof vi.fn> };
  let mockMetaEventsService: { sendAppEvent: ReturnType<typeof vi.fn> };

  const userId = 'user-123';
  const email = 'rider@example.com';

  const fakeUserRow = {
    id: userId,
    email,
    full_name: 'Test Rider',
    role: 'user',
    preferences: { theme: 'dark' },
    subscription_tier: 'free',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  function createMockClient() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });

    return {
      from: vi.fn().mockReturnValue(chain),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      _chain: chain,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClient = createMockClient();
    mockDataExportService = {
      requestDataExport: vi.fn().mockResolvedValue({ id: 'export-1', status: 'pending' }),
    };
    mockRevenueCatService = {
      cancelSubscription: vi.fn().mockResolvedValue(undefined),
    };
    mockEmailService = {
      sendAccountDeletionConfirmation: vi.fn().mockResolvedValue(undefined),
    };
    mockMetaEventsService = {
      sendAppEvent: vi.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      mockUserClient as never,
      mockUserClient as never,
      mockDataExportService as unknown as DataExportService,
      mockRevenueCatService as never,
      mockEmailService as never,
      mockMetaEventsService as never,
    );
  });

  describe('findById', () => {
    it('should return a mapped user', async () => {
      mockUserClient._chain.single.mockResolvedValueOnce({
        data: fakeUserRow,
        error: null,
      });

      const result = await service.findById(userId);

      expect(result.id).toBe(userId);
      expect(result.email).toBe(email);
      expect(result.fullName).toBe('Test Rider');
      expect(result.role).toBe('user');
      expect(mockUserClient.from).toHaveBeenCalledWith('users');
    });

    it('should throw NotFoundException when not found', async () => {
      mockUserClient._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should merge preferences with existing (preserves unmodified fields)', async () => {
      // First call: fetch current preferences
      mockUserClient._chain.single
        .mockResolvedValueOnce({
          data: { preferences: { theme: 'dark', locale: 'en' } },
          error: null,
        })
        // Second call: update returns updated row
        .mockResolvedValueOnce({
          data: {
            ...fakeUserRow,
            preferences: { theme: 'dark', locale: 'en', maintenanceReminders: true },
          },
          error: null,
        });

      const result = await service.update(userId, {
        preferences: { maintenanceReminders: true } as Record<string, unknown>,
      });

      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            theme: 'dark',
            locale: 'en',
            maintenanceReminders: true,
          }),
        }),
      );
      expect(result.preferences).toEqual(
        expect.objectContaining({ theme: 'dark', locale: 'en', maintenanceReminders: true }),
      );
    });

    it('should throw BadRequestException on invalid preferences', async () => {
      // UserPreferencesSchema.safeParse will fail for invalid input
      // We pass something that Zod won't accept
      await expect(
        service.update(userId, {
          preferences: { maintenanceReminders: 'not-a-boolean' } as unknown as Record<
            string,
            unknown
          >,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeOnboarding', () => {
    it('should call RPC with correct payload', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: null });
      // findById is called after RPC
      mockUserClient._chain.single.mockResolvedValueOnce({
        data: fakeUserRow,
        error: null,
      });

      const input = {
        experienceLevel: 'intermediate',
        ridingGoals: ['commuting'],
        learningFormats: ['articles'],
        bikeMake: 'Honda',
        bikeModel: 'CB500F',
        bikeYear: 2023,
      };

      await service.completeOnboarding(userId, input as never);

      expect(mockUserClient.rpc).toHaveBeenCalledWith(
        'complete_onboarding',
        expect.objectContaining({
          p_user_id: userId,
          p_preferences: expect.objectContaining({
            onboardingCompleted: true,
            experienceLevel: 'intermediate',
          }),
          p_bike_make: 'Honda',
          p_bike_model: 'CB500F',
          p_bike_year: 2023,
        }),
      );
    });

    it('should pass bikeModel and bikeType to RPC when provided', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: null });
      mockUserClient._chain.single.mockResolvedValueOnce({
        data: fakeUserRow,
        error: null,
      });

      const input = {
        experienceLevel: 'advanced',
        ridingGoals: ['track_rides', 'maintain_bike'],
        learningFormats: [],
        bikeMake: 'BMW',
        bikeModel: 'R 1250 GS',
        bikeYear: 2024,
        bikeType: 'dual_sport',
        bikeMileage: 500,
        bikeMileageUnit: 'km',
      };

      await service.completeOnboarding(userId, input as never);

      expect(mockUserClient.rpc).toHaveBeenCalledWith(
        'complete_onboarding',
        expect.objectContaining({
          p_user_id: userId,
          p_bike_make: 'BMW',
          p_bike_model: 'R 1250 GS',
          p_bike_year: 2024,
          p_bike_type: 'dual_sport',
          p_bike_mileage: 500,
          p_mileage_unit: 'km',
        }),
      );
    });

    it('should pass null for bike fields when no bike data provided', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: null });
      mockUserClient._chain.single.mockResolvedValueOnce({
        data: fakeUserRow,
        error: null,
      });

      const input = {
        experienceLevel: 'beginner',
        ridingGoals: ['just_exploring'],
        learningFormats: [],
      };

      await service.completeOnboarding(userId, input as never);

      expect(mockUserClient.rpc).toHaveBeenCalledWith(
        'complete_onboarding',
        expect.objectContaining({
          p_bike_make: null,
          p_bike_model: null,
          p_bike_year: null,
          p_bike_type: null,
          p_bike_mileage: null,
        }),
      );
    });

    it('should throw BadRequestException when RPC fails', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(
        service.completeOnboarding(userId, {
          experienceLevel: 'beginner',
          ridingGoals: [],
          learningFormats: [],
        } as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAccount', () => {
    it('should call soft_delete_user RPC', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      const result = await service.deleteAccount(userId, email);

      expect(result).toBe(true);
      expect(mockUserClient.rpc).toHaveBeenCalledWith('soft_delete_user', {
        p_user_id: userId,
      });
    });

    it('should fire RevenueCat cancel (verify mock called)', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      await service.deleteAccount(userId, email);

      expect(mockRevenueCatService.cancelSubscription).toHaveBeenCalledWith(userId);
    });

    it('should not throw when RevenueCat cancellation fails (fire-and-forget)', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: null });
      mockRevenueCatService.cancelSubscription.mockRejectedValueOnce(
        new Error('RevenueCat unreachable'),
      );

      // Should not throw despite RevenueCat failure
      const result = await service.deleteAccount(userId, email);
      expect(result).toBe(true);
    });

    it('should fire email notification (verify mock called)', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: null, error: null });

      await service.deleteAccount(userId, email);

      expect(mockEmailService.sendAccountDeletionConfirmation).toHaveBeenCalledWith(email);
    });
  });

  describe('requestDataExport', () => {
    it('should delegate to dataExportService', async () => {
      const result = await service.requestDataExport(userId, email);

      expect(mockDataExportService.requestDataExport).toHaveBeenCalledWith(userId, email);
      expect(result).toEqual({ id: 'export-1', status: 'pending' });
    });
  });
});
