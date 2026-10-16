import { FREE_TIER_LIMITS } from '@motovault/types';
import { ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  describe('getFeatureUsage', () => {
    afterEach(() => vi.useRealTimers());

    it('returns the same success count the limit enforces, with the limit and next-month reset', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-12-15T10:00:00Z'));
      mockAdmin._chain.then.mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ count: 1, error: null }),
      );

      const usage = await service.getFeatureUsage('u1', AI_CONTENT_TYPES.DIAGNOSTIC);

      expect(usage).toEqual({
        used: 1,
        limit: FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH,
        resetDate: '2027-01-01T00:00:00.000Z',
      });
      expect(mockAdmin._chain.eq).toHaveBeenCalledWith('content_type', AI_CONTENT_TYPES.DIAGNOSTIC);
      expect(mockAdmin._chain.eq).toHaveBeenCalledWith('status', 'success');
      expect(mockAdmin._chain.gte).toHaveBeenCalledWith('created_at', '2026-12-01T00:00:00.000Z');
    });

    it('does not read the tier — usage is tier-independent', async () => {
      mockAdmin._chain.then.mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ count: 0, error: null }),
      );

      await service.getFeatureUsage('u1', AI_CONTENT_TYPES.DIAGNOSTIC);

      expect(mockAdmin._chain.single).not.toHaveBeenCalled();
    });

    it('fails closed (ISE) when the count errors', async () => {
      mockAdmin._chain.then.mockImplementation((resolve: (v: unknown) => void) =>
        resolve({ count: null, error: { message: 'db down' } }),
      );

      await expect(service.getFeatureUsage('u1', AI_CONTENT_TYPES.DIAGNOSTIC)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
