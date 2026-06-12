import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RideSummariesService } from './ride-summaries.service';

describe('RideSummariesService', () => {
  let service: RideSummariesService;
  let mockAdminClient: ReturnType<typeof createMockClient>;
  let mockAiBudgetService: { checkBudgetForUser: ReturnType<typeof vi.fn> };
  let mockConfigService: { getOrThrow: ReturnType<typeof vi.fn> };

  const userId = 'user-rs-1111-2222-3333-4444aaaabbbb';
  const rideId = 'ride-rs-aaaa-bbbb-cccc-dddd1111eeee';

  const fakeRideRow = {
    id: rideId,
    user_id: userId,
    motorcycle_id: 'moto-rs-001',
    name: 'Mountain Pass Cruise',
    distance_m: 45000,
    started_at: '2026-04-06T08:00:00Z',
    ended_at: '2026-04-06T09:30:00Z',
    max_speed_mps: 33.5,
    avg_speed_mps: 22.1,
    elevation_gain: 850,
    elevation_loss: 830,
    region: 'Tatras, Slovakia',
    paused_duration_s: 120,
  };

  const fakeShortRide = {
    ...fakeRideRow,
    distance_m: 500, // Below MIN_DISTANCE_M (1000)
  };

  const fakeShortDurationRide = {
    ...fakeRideRow,
    distance_m: 5000,
    started_at: '2026-04-06T08:00:00Z',
    ended_at: '2026-04-06T08:03:00Z', // 3 minutes, below MIN_DURATION_S (300)
    paused_duration_s: 0,
  };

  const fakeSummaryRow = {
    id: 'summary-1234-5678-9012-3456abcdefgh',
    ride_id: rideId,
    summary_text: 'An exhilarating 45 km ride through the Tatras on your Ducati.',
    generation_status: 'completed',
    locale: 'en',
    created_at: '2026-04-06T10:00:00Z',
    updated_at: '2026-04-06T10:00:00Z',
  };

  const fakeBikeRow = {
    make: 'Ducati',
    model: 'Monster 937',
    year: 2024,
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
      _chain: chain,
      _pushResult: pushResult,
      _resetIndex: resetIndex,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient = createMockClient();
    mockAiBudgetService = { checkBudgetForUser: vi.fn().mockResolvedValue(undefined) };
    mockConfigService = { getOrThrow: vi.fn().mockReturnValue('fake-openai-key') };

    // Singleton service: admin client only (the user client made it request-scoped,
    // which broke the event listener — see service doc-comment).
    service = new RideSummariesService(
      mockConfigService as never,
      mockAdminClient as never,
      mockAiBudgetService as never,
    );
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  function allowFreeTierSummaryGeneration() {
    // Admin result 0: subscription tier lookup
    mockAdminClient._pushResult({ data: { subscription_tier: 'free' } });
    // Admin result 1: monthly ride summary count
    mockAdminClient._pushResult({ count: 0 });
  }

  function useProTier() {
    mockAdminClient._pushResult({ data: { subscription_tier: 'pro' } });
  }

  describe('generateSummary', () => {
    it('should generate a summary for a valid ride with AI call', async () => {
      allowFreeTierSummaryGeneration();
      // Admin result 2: ride fetch (.single())
      mockAdminClient._pushResult({ data: fakeRideRow });
      // Admin result 3: motorcycle fetch (.single())
      mockAdminClient._pushResult({ data: fakeBikeRow });
      // Admin result 4: existing summary check (maybeSingle)
      mockAdminClient._pushResult({ data: null });

      // Mock OpenAI call
      const mockParse = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              parsed: {
                summaryText: 'An exhilarating 45 km ride through the Tatras on your Ducati.',
              },
            },
          },
        ],
        usage: { prompt_tokens: 150, completion_tokens: 60 },
      });
      // biome-ignore lint/suspicious/noExplicitAny: mocking private openai for test isolation
      (service as any).openai = {
        chat: { completions: { parse: mockParse } },
      };

      // Admin result 5: insert summary (.single())
      mockAdminClient._pushResult({ data: fakeSummaryRow });
      // Admin result 6: update rides.ai_summary (thenable)
      mockAdminClient._pushResult({ data: null, error: null });
      // Admin result 7: log generation (thenable)
      mockAdminClient._pushResult({ data: null, error: null });
      // Admin result 8: fetch saved summary (.single())
      mockAdminClient._pushResult({ data: fakeSummaryRow });

      const result = await service.generateSummary(rideId, userId, 'en');

      expect(result.id).toBe(fakeSummaryRow.id);
      expect(result.rideId).toBe(rideId);
      expect(result.summaryText).toBe(
        'An exhilarating 45 km ride through the Tatras on your Ducati.',
      );
      expect(result.generationStatus).toBe('completed');
      expect(result.locale).toBe('en');
      expect(mockAiBudgetService.checkBudgetForUser).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when ride is below distance threshold', async () => {
      allowFreeTierSummaryGeneration();
      mockAdminClient._pushResult({ data: fakeShortRide });

      await expect(service.generateSummary(rideId, userId, 'en')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when ride is below duration threshold', async () => {
      allowFreeTierSummaryGeneration();
      mockAdminClient._pushResult({ data: fakeShortDurationRide });

      await expect(service.generateSummary(rideId, userId, 'en')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when AI budget is exceeded', async () => {
      allowFreeTierSummaryGeneration();
      mockAiBudgetService.checkBudgetForUser.mockRejectedValue(
        new Error('Monthly AI budget exceeded'),
      );

      await expect(service.generateSummary(rideId, userId, 'en')).rejects.toThrow(
        'Monthly AI budget exceeded',
      );
    });

    it('should block free users after the monthly AI summary allowance', async () => {
      mockAdminClient._pushResult({ data: { subscription_tier: 'free' } });
      mockAdminClient._pushResult({ count: 3 });

      await expect(service.generateSummary(rideId, userId, 'en')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockAiBudgetService.checkBudgetForUser).not.toHaveBeenCalled();
    });

    it('should skip the free summary quota for Pro users', async () => {
      useProTier();
      mockAiBudgetService.checkBudgetForUser.mockRejectedValue(new Error('budget checked'));

      await expect(service.generateSummary(rideId, userId, 'en')).rejects.toThrow('budget checked');
      expect(mockAiBudgetService.checkBudgetForUser).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException when ride not found', async () => {
      allowFreeTierSummaryGeneration();
      mockAdminClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.generateSummary(rideId, userId, 'en')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('onRideCompleted', () => {
    it('should call generateSummary when ride.completed event fires', async () => {
      const generateSpy = vi
        .spyOn(service, 'generateSummary')
        .mockResolvedValue(fakeSummaryRow as never);

      // Idempotency pre-check finds no existing summary
      mockAdminClient._pushResult({ data: null });

      await service.onRideCompleted({
        rideId,
        userId,
        locale: 'en',
      });

      expect(generateSpy).toHaveBeenCalledWith(rideId, userId, 'en');
    });

    it('should skip generation when a completed summary already exists (duplicate event)', async () => {
      const generateSpy = vi
        .spyOn(service, 'generateSummary')
        .mockResolvedValue(fakeSummaryRow as never);

      mockAdminClient._pushResult({
        data: { id: fakeSummaryRow.id, generation_status: 'completed' },
      });

      await service.onRideCompleted({ rideId, userId, locale: 'en' });

      expect(generateSpy).not.toHaveBeenCalled();
    });

    it('should not throw when generateSummary fails (non-fatal)', async () => {
      vi.spyOn(service, 'generateSummary').mockRejectedValue(
        new NotFoundException('Ride too short'),
      );

      // Should not throw — event handler catches errors
      await expect(
        service.onRideCompleted({ rideId, userId, locale: 'en' }),
      ).resolves.toBeUndefined();
    });
  });
});
