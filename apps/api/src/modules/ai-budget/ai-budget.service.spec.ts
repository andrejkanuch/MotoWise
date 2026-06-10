import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_CONTENT_TYPES, AiBudgetService } from './ai-budget.service';

describe('AiBudgetService', () => {
  let service: AiBudgetService;
  let mockAdmin: {
    rpc: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    _chain: Record<string, ReturnType<typeof vi.fn>>;
  };

  function makeChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ['select', 'update', 'eq', 'gte']) chain[m] = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn();
    // count query is awaited directly off the builder (thenable)
    // biome-ignore lint/suspicious/noThenProperty: Supabase builder is thenable
    chain.then = vi.fn();
    return chain;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    const chain = makeChain();
    mockAdmin = { rpc: vi.fn(), from: vi.fn().mockReturnValue(chain), _chain: chain };
    // Redis null → in-memory circuit-breaker fallback
    service = new AiBudgetService(mockAdmin as never, null);
    // biome-ignore lint/suspicious/noExplicitAny: suppress logger noise
    (service as any).logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  });

  describe('reserveGeneration', () => {
    it('returns the reservation row id from the RPC', async () => {
      mockAdmin.rpc.mockResolvedValue({ data: 'log-row-1', error: null });

      const id = await service.reserveGeneration('u1', AI_CONTENT_TYPES.ONBOARDING_INSIGHTS, 5);

      expect(id).toBe('log-row-1');
      expect(mockAdmin.rpc).toHaveBeenCalledWith('reserve_ai_generation', {
        p_user_id: 'u1',
        p_content_type: 'onboarding_insights',
        p_daily_limit: 5,
      });
    });

    it('maps the daily_limit_exceeded RPC error to ForbiddenException', async () => {
      mockAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'daily_limit_exceeded' },
      });

      await expect(service.reserveGeneration('u1', AI_CONTENT_TYPES.DIAGNOSTIC, 3)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('fails closed (ISE) on any other RPC error', async () => {
      mockAdmin.rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });

      await expect(service.reserveGeneration('u1', AI_CONTENT_TYPES.ARTICLE, 5)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('recordGeneration', () => {
    it('finalizes the pending row with model/tokens/derived cost and never throws on error', async () => {
      mockAdmin._chain.eq.mockResolvedValue({ error: { message: 'update failed' } });

      await expect(
        service.recordGeneration({
          reservationId: 'log-row-1',
          model: 'gpt-4.1-nano',
          inputTokens: 100,
          outputTokens: 50,
          status: 'success',
        }),
      ).resolves.toBeUndefined();

      expect(mockAdmin.from).toHaveBeenCalledWith('content_generation_log');
      const updateArg = mockAdmin._chain.update.mock.calls[0][0];
      expect(updateArg).toMatchObject({
        model: 'gpt-4.1-nano',
        input_tokens: 100,
        output_tokens: 50,
        status: 'success',
      });
      expect(updateArg.cost_cents).toBeGreaterThanOrEqual(0);
    });
  });

  describe('enforceFeatureLimit', () => {
    it('does not throw for Pro users regardless of usage', async () => {
      mockAdmin._chain.single.mockResolvedValue({
        data: { subscription_tier: 'pro' },
        error: null,
      });

      await expect(
        service.enforceFeatureLimit('u1', AI_CONTENT_TYPES.ARTICLE),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when a free user is at the limit', async () => {
      mockAdmin._chain.single.mockResolvedValue({
        data: { subscription_tier: 'free' },
        error: null,
      });
      mockAdmin._chain.then.mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ count: 999, error: null }),
      );

      await expect(service.enforceFeatureLimit('u1', AI_CONTENT_TYPES.ARTICLE)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('fails closed (ISE) when the tier lookup errors', async () => {
      mockAdmin._chain.single.mockResolvedValue({ data: null, error: { message: 'db down' } });

      await expect(service.enforceFeatureLimit('u1', AI_CONTENT_TYPES.DIAGNOSTIC)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
