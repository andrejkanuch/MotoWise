import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AffiliatesService } from './affiliates.service';

describe('AffiliatesService', () => {
  let service: AffiliatesService;
  let mockUserClient: ReturnType<typeof createMockClient>;

  const userId = 'user-af1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c';

  const _fakeClickRow = {
    id: 'click-1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    user_id: userId,
    partner: 'revzilla',
    product_url: 'https://www.revzilla.com/motorcycle/shoei-rf-1400-helmet',
    diagnosis_type: 'engine_noise',
    created_at: '2026-04-07T10:00:00Z',
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
    mockUserClient = createMockClient();

    service = new AffiliatesService(mockUserClient as never);
    // Suppress logger output during tests
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  describe('trackClick', () => {
    it('should track a click and return affiliate product', async () => {
      mockUserClient._pushResult({ data: null, error: null });

      const result = await service.trackClick(userId, {
        partner: 'revzilla',
        productUrl: 'https://www.revzilla.com/motorcycle/shoei-rf-1400-helmet',
        diagnosisType: 'engine_noise',
      });

      expect(result.partner).toBe('revzilla');
      expect(result.affiliateUrl).toContain('ref=motovault-20');
      expect(result.productUrl).toBe('https://www.revzilla.com/motorcycle/shoei-rf-1400-helmet');
      expect(result.tracked).toBe(true);
      expect(mockUserClient.from).toHaveBeenCalledWith('affiliate_clicks');
      expect(mockUserClient._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          partner: 'revzilla',
        }),
      );
    });

    it('should handle duplicate click gracefully (23505 error code)', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      });

      const result = await service.trackClick(userId, {
        partner: 'revzilla',
        productUrl: 'https://www.revzilla.com/motorcycle/shoei-rf-1400-helmet',
      });

      expect(result.tracked).toBe(false);
      expect(result.partner).toBe('revzilla');
      expect(result.affiliateUrl).toContain('ref=motovault-20');
    });

    it('should throw BadRequestException for invalid partner', async () => {
      await expect(
        service.trackClick(userId, {
          partner: 'invalid_partner',
          productUrl: 'https://www.example.com/product',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on non-duplicate DB error', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Connection error', code: '08006' },
      });

      await expect(
        service.trackClick(userId, {
          partner: 'revzilla',
          productUrl: 'https://www.revzilla.com/motorcycle/shoei-rf-1400-helmet',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAffiliateUrl', () => {
    it('should append ref param for RevZilla URLs', () => {
      const url = service.getAffiliateUrl(
        'revzilla',
        'https://www.revzilla.com/motorcycle/shoei-rf-1400-helmet',
      );

      expect(url).toContain('ref=motovault-20');
    });

    it('should append tag param for Amazon URLs', () => {
      const url = service.getAffiliateUrl('amazon', 'https://www.amazon.com/dp/B08XYZ1234');

      expect(url).toContain('tag=motovault-20');
    });

    it('should reject domains not in allowlist', () => {
      expect(() =>
        service.getAffiliateUrl('revzilla', 'https://www.evil-site.com/product'),
      ).toThrow(BadRequestException);
    });

    it('should return original URL for invalid URL format', () => {
      const url = service.getAffiliateUrl('revzilla', 'not-a-valid-url');

      expect(url).toBe('not-a-valid-url');
    });

    it('should return original URL for unknown partner', () => {
      const url = service.getAffiliateUrl('unknown_partner', 'https://www.example.com/product');

      expect(url).toBe('https://www.example.com/product');
    });
  });
});
