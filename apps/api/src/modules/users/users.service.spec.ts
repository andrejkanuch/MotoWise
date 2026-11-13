import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVICE_PLAN_TIER } from '../oem-schedules/service-plan';
import type { DataExportService } from './data-export.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockUserClient: ReturnType<typeof createMockClient>;
  let mockDataExportService: { requestDataExport: ReturnType<typeof vi.fn> };
  let mockRevenueCatService: { cancelSubscription: ReturnType<typeof vi.fn> };
  let mockEmailService: { sendAccountDeletionConfirmation: ReturnType<typeof vi.fn> };
  let mockMetaEventsService: { sendAppEvent: ReturnType<typeof vi.fn> };
  let mockOemSchedulesService: { importServicePlan: ReturnType<typeof vi.fn> };
  let mockConfigService: { get: ReturnType<typeof vi.fn> };

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
      auth: {
        admin: {
          getUserById: vi
            .fn()
            .mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null }),
        },
      },
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
    mockOemSchedulesService = {
      importServicePlan: vi.fn().mockResolvedValue({
        taskCount: 0,
        insertedCount: 0,
        tier: null,
        measurementSystem: 'metric',
      }),
    };
    // No PostHog token by default: nothing is captured unless a test opts in.
    mockConfigService = { get: vi.fn().mockReturnValue(undefined) };

    service = new UsersService(
      mockUserClient as never,
      mockUserClient as never,
      mockDataExportService as unknown as DataExportService,
      mockRevenueCatService as never,
      mockEmailService as never,
      mockMetaEventsService as never,
      mockOemSchedulesService as never,
      mockConfigService as never,
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

    it('should throw NotFoundException when no row comes back without an error', async () => {
      mockUserClient._chain.single.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.findById(userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException (not NotFound) on a database fault', async () => {
      mockUserClient._chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection terminated', code: '08006' },
      });

      await expect(service.findById(userId)).rejects.toThrow(InternalServerErrorException);
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
      // UserPreferencesSchema is .passthrough() — unknown keys are accepted, so the
      // invalid value must target a key the schema actually validates.
      await expect(
        service.update(userId, {
          preferences: { experienceLevel: 'not-a-valid-level' } as unknown as Record<
            string,
            unknown
          >,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeOnboarding', () => {
    it('stores the onboarding contact opt-in in p_preferences when ticked', async () => {
      mockUserClient._chain.single.mockResolvedValueOnce({ data: fakeUserRow, error: null });

      await service.completeOnboarding(userId, {
        experienceLevel: 'beginner',
        ridingGoals: [],
        learningFormats: [],
        feedbackContactOptIn: { wordingVersion: 1, locale: 'de' },
      } as never);

      const prefs = mockUserClient.rpc.mock.calls[0][1].p_preferences;
      expect(prefs.feedbackContact).toMatchObject({
        enabled: true,
        email: null,
        wordingVersion: 1,
        locale: 'de',
        source: 'onboarding',
      });
      expect(Number.isNaN(Date.parse(prefs.feedbackContact.decidedAt))).toBe(false);
    });

    it('leaves feedbackContact out of p_preferences when not ticked', async () => {
      mockUserClient._chain.single.mockResolvedValueOnce({ data: fakeUserRow, error: null });

      await service.completeOnboarding(userId, {
        experienceLevel: 'beginner',
        ridingGoals: [],
        learningFormats: [],
      } as never);

      expect(mockUserClient.rpc.mock.calls[0][1].p_preferences).not.toHaveProperty(
        'feedbackContact',
      );
    });

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

  // #365 T07a (Experiment 2): onboarding imports the service plan for the bike it created.
  describe('completeOnboarding — service plan import (#365 T07a)', () => {
    const motorcycleId = 'moto-1';
    const bikeRow = {
      id: motorcycleId,
      make: 'Yamaha',
      model: 'MT-09',
      year: 2019,
      variant: null,
      current_mileage: 1200,
    };
    const bikeInput = {
      experienceLevel: 'beginner',
      ridingGoals: [],
      learningFormats: [],
      bikeMake: 'Yamaha',
      bikeModel: 'MT-09',
      bikeYear: 2019,
    };
    const imported = {
      taskCount: 9,
      insertedCount: 9,
      tier: SERVICE_PLAN_TIER.MODEL,
      measurementSystem: 'metric',
    };

    function arrange(opts: { userRow?: Record<string, unknown>; rpcBikeId?: string | null } = {}) {
      mockUserClient.rpc.mockResolvedValueOnce({
        data: {
          user_id: userId,
          motorcycle_id: opts.rpcBikeId === undefined ? motorcycleId : opts.rpcBikeId,
        },
        error: null,
      });
      mockUserClient._chain.single
        .mockResolvedValueOnce({ data: opts.userRow ?? fakeUserRow, error: null })
        .mockResolvedValueOnce({ data: bikeRow, error: null });
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('imports the full waterfall (no id filter) for the bike the RPC returned', async () => {
      arrange();
      mockOemSchedulesService.importServicePlan.mockResolvedValueOnce(imported);

      const user = await service.completeOnboarding(userId, bikeInput as never);

      expect(mockOemSchedulesService.importServicePlan).toHaveBeenCalledTimes(1);
      const [, params] = mockOemSchedulesService.importServicePlan.mock.calls[0];
      expect(params).toMatchObject({
        userId,
        motorcycleId,
        make: 'Yamaha',
        model: 'MT-09',
        year: 2019,
        currentMileage: 1200,
      });
      expect(params.scheduleIdFilter).toBeUndefined();
      expect(user.servicePlanTaskCount).toBe(9);
      expect(user.servicePlanTier).toBe(SERVICE_PLAN_TIER.MODEL);
    });

    it.each([
      ['mi', 'imperial'],
      ['km', 'metric'],
    ])('imports in the rider’s unit: bikeMileageUnit %s → %s', async (unit, system) => {
      arrange();
      await service.completeOnboarding(userId, { ...bikeInput, bikeMileageUnit: unit } as never);
      const [, params] = mockOemSchedulesService.importServicePlan.mock.calls[0];
      expect(params.measurementSystem).toBe(system);
    });

    it('keeps the id filter for the riders who picked tasks (intent cohort)', async () => {
      arrange();
      await service.completeOnboarding(userId, {
        ...bikeInput,
        acceptedOemScheduleIds: ['s-1', 's-2'],
      } as never);
      const [, params] = mockOemSchedulesService.importServicePlan.mock.calls[0];
      expect(params.scheduleIdFilter).toEqual(['s-1', 's-2']);
    });

    it('does not import when onboarding created no bike', async () => {
      mockUserClient._chain.single.mockResolvedValueOnce({ data: fakeUserRow, error: null });
      const user = await service.completeOnboarding(userId, {
        experienceLevel: 'beginner',
        ridingGoals: [],
        learningFormats: [],
      } as never);
      expect(mockOemSchedulesService.importServicePlan).not.toHaveBeenCalled();
      expect(user.servicePlanTaskCount).toBeUndefined();
      expect(user.servicePlanTier).toBeUndefined();
    });

    it('does not import when the RPC returned no bike id (make without a year)', async () => {
      arrange({ rpcBikeId: null });
      await service.completeOnboarding(userId, bikeInput as never);
      expect(mockOemSchedulesService.importServicePlan).not.toHaveBeenCalled();
    });

    it('never fails onboarding when the import throws', async () => {
      arrange();
      mockOemSchedulesService.importServicePlan.mockRejectedValueOnce(new Error('db down'));
      const user = await service.completeOnboarding(userId, bikeInput as never);
      expect(user.id).toBe(userId);
      expect(user.servicePlanTaskCount).toBeUndefined();
    });

    it('a second run hands the same bike to the import, which dedups by oem_schedule_id', async () => {
      arrange();
      mockOemSchedulesService.importServicePlan.mockResolvedValueOnce(imported);
      await service.completeOnboarding(userId, bikeInput as never);
      arrange();
      mockOemSchedulesService.importServicePlan.mockResolvedValueOnce({
        ...imported,
        insertedCount: 0,
      });
      const second = await service.completeOnboarding(userId, bikeInput as never);

      const bikeIds = mockOemSchedulesService.importServicePlan.mock.calls.map(
        ([, p]) => p.motorcycleId,
      );
      expect(bikeIds).toEqual([motorcycleId, motorcycleId]);
      // The plan is still there, so the result still reports it.
      expect(second.servicePlanTaskCount).toBe(9);
    });

    it('the import path sends no maintenance push', async () => {
      arrange();
      mockOemSchedulesService.importServicePlan.mockResolvedValueOnce(imported);
      await service.completeOnboarding(userId, bikeInput as never);
      const tables = mockUserClient.from.mock.calls.map(([t]) => t);
      expect(tables).not.toContain('maintenance_push_log');
      expect(tables).not.toContain('device_push_tokens');
    });

    describe('service_plan_imported consent', () => {
      function stubPostHog() {
        mockConfigService.get.mockImplementation((key: string) =>
          key === 'POSTHOG_PROJECT_TOKEN' ? 'phc_test' : undefined,
        );
        const bodies: Array<{ batch: Array<Record<string, unknown>> }> = [];
        const fetchFn = vi.fn(async (_url: string, init?: { body?: string }) => {
          if (init?.body) bodies.push(JSON.parse(init.body));
          return { ok: true, status: 200 } as Response;
        });
        vi.stubGlobal('fetch', fetchFn);
        return { bodies, fetchFn };
      }

      async function captured(userRow: Record<string, unknown>, signupMetadata: unknown = {}) {
        const { bodies, fetchFn } = stubPostHog();
        mockUserClient.auth.admin.getUserById.mockResolvedValueOnce({
          data: { user: { user_metadata: signupMetadata } },
          error: null,
        });
        arrange({ userRow });
        mockOemSchedulesService.importServicePlan.mockResolvedValueOnce({
          ...imported,
          measurementSystem: 'imperial',
        });
        await service.completeOnboarding(userId, { ...bikeInput, bikeMileageUnit: 'mi' } as never);
        await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
        return bodies[0].batch[0];
      }

      it('a stored "yes" → distinct_id is the user id', async () => {
        const event = await captured({
          ...fakeUserRow,
          preferences: { privacy: { analyticsEnabled: true } },
        });
        expect(event.event).toBe('service_plan_imported');
        expect(event.distinct_id).toBe(userId);
        expect(event.properties).toMatchObject({
          tier: 'model',
          task_count: 9,
          unit: 'mi',
          source: 'onboarding',
        });
      });

      it('a stored "no" → no user id in the payload', async () => {
        const event = await captured({
          ...fakeUserRow,
          preferences: { privacy: { analyticsEnabled: false } },
        });
        expect(JSON.stringify(event)).not.toContain(userId);
        expect(event.properties).toMatchObject({ $process_person_profile: false });
      });

      it('no decision stored yet (OAuth sign-up) → no user id in the payload', async () => {
        const event = await captured({ ...fakeUserRow, preferences: {} }, {});
        expect(JSON.stringify(event)).not.toContain(userId);
        expect(JSON.stringify(event)).not.toContain(email);
      });

      it('falls back to the sign-up decision when the account has none', async () => {
        const event = await captured(
          { ...fakeUserRow, preferences: {} },
          { analytics_consent: true },
        );
        expect(event.distinct_id).toBe(userId);
      });

      it('a PostHog failure never fails onboarding', async () => {
        mockConfigService.get.mockReturnValue('phc_test');
        vi.stubGlobal(
          'fetch',
          vi.fn(async () => {
            throw new Error('network');
          }),
        );
        arrange();
        mockOemSchedulesService.importServicePlan.mockResolvedValueOnce(imported);
        const user = await service.completeOnboarding(userId, bikeInput as never);
        expect(user.servicePlanTaskCount).toBe(9);
      });
    });
  });
});
