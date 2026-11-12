import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpstreamUnavailableException } from '../../common/exceptions/upstream-unavailable.exception';
import { NhtsaService } from './nhtsa.service';

describe('NhtsaService', () => {
  let service: NhtsaService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // shouldAdvanceTime: the service's short retry backoff (a real setTimeout)
    // elapses on its own; tests still jump hours ahead with advanceTimersByTime.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    globalThis.fetch = vi.fn();
    service = new NhtsaService();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  describe('getMakes', () => {
    const apiResponse = {
      Results: [
        { MakeId: 1, MakeName: 'ZUNDAPP' },
        { MakeId: 2, MakeName: 'HONDA' },
        { MakeId: 3, MakeName: 'APRILIA' },
      ],
    };

    it('should return cached data when cache is valid (no fetch call)', async () => {
      // Manually populate cache via a first fetch
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });
      await service.getMakes();

      // Clear mock to verify no second call
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();

      const result = await service.getMakes();

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(result.length).toBe(3);
    });

    it('should fetch from API on cache miss and sort popular-first', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });

      const result = await service.getMakes();

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      // Popular makes (APRILIA, HONDA) should come before non-popular (ZUNDAPP)
      const names = result.map((m) => m.makeName);
      expect(names).toEqual(['APRILIA', 'HONDA', 'ZUNDAPP']);
      expect(result[0].isPopular).toBe(true);
      expect(result[1].isPopular).toBe(true);
      expect(result[2].isPopular).toBe(false);
    });

    it('should throw ServiceUnavailableException on fetch error', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(service.getMakes()).rejects.toThrow(ServiceUnavailableException);
    });

    it('should return empty array when API returns empty Results', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Results: [] }),
      });

      const result = await service.getMakes();

      expect(result).toEqual([]);
    });

    it('serves stale cache when the refresh fetch fails after expiry (MOTO-VAULT-NODE-NESTJS-4)', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
      vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });
      await service.getMakes();

      // Expire the 24h cache, then fail the refresh (both retry attempts).
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NHTSA down'));

      const result = await service.getMakes();

      expect(result.map((m) => m.makeName)).toEqual(['APRILIA', 'HONDA', 'ZUNDAPP']);
    });

    it('does not hide a request defect (e.g. 403) behind the stale cache', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
      vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });
      await service.getMakes();

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      });

      const error = await service.getMakes().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error).not.toBeInstanceOf(UpstreamUnavailableException);
    });

    it('re-arms a stale-served cache so the upstream is not retried within the cooldown', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
      vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiResponse),
      });
      await service.getMakes();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NHTSA down'));
      await service.getMakes();

      // Within the cooldown: served from cache, no upstream call.
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();
      await service.getMakes();
      expect(globalThis.fetch).not.toHaveBeenCalled();

      // After the cooldown: the upstream is retried again.
      vi.advanceTimersByTime(61_000);
      await service.getMakes();
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it('still throws when the fetch fails and no cache was ever populated', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NHTSA down'));

      await expect(service.getMakes()).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('getModels', () => {
    const modelsResponse = {
      Results: [
        { Model_ID: 10, Model_Name: 'CB500F' },
        { Model_ID: 11, Model_Name: 'Africa Twin' },
      ],
    };

    it('should return cached data when valid', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(modelsResponse),
      });
      await service.getModels(2, 2023);

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();

      const result = await service.getModels(2, 2023);

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(result.length).toBe(2);
    });

    it('should fetch from API on cache miss', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(modelsResponse),
      });

      const result = await service.getModels(2, 2023);

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      // Sorted alphabetically
      expect(result[0].modelName).toBe('Africa Twin');
      expect(result[1].modelName).toBe('CB500F');
    });

    it('should return empty array when API returns empty Results', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Results: [] }),
      });

      const result = await service.getModels(999, 2023);

      expect(result).toEqual([]);
    });

    it('serves stale cache when the refresh fetch fails after expiry', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
      vi.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(modelsResponse),
      });
      await service.getModels(2, 2023);

      // Expire the 7d cache, then fail the refresh.
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('NHTSA down'));

      const result = await service.getModels(2, 2023);

      expect(result.map((m) => m.modelName)).toEqual(['Africa Twin', 'CB500F']);
    });

    it('should evict oldest entry when cache reaches 500 entries (LRU eviction)', async () => {
      // Fill cache to 500 entries
      for (let i = 0; i < 500; i++) {
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ Results: [{ Model_ID: i, Model_Name: `Model${i}` }] }),
        });
        await service.getModels(i, 2000);
      }

      // Add one more — should evict the first entry (makeId=0, year=2000)
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Results: [{ Model_ID: 500, Model_Name: 'Model500' }] }),
      });
      await service.getModels(500, 2000);

      // Now fetching makeId=0, year=2000 should require a new fetch (was evicted)
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Results: [{ Model_ID: 0, Model_Name: 'Model0' }] }),
      });
      const result = await service.getModels(0, 2000);

      // fetch was called for the evicted entry
      expect(result[0].modelName).toBe('Model0');
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  describe('getRecalls', () => {
    const CAMPAIGN = {
      NHTSACampaignNumber: '20V797000',
      ReportReceivedDate: '2020-12-15',
      Component: 'FUEL SYSTEM, GASOLINE:STORAGE:TANK ASSEMBLY',
      Summary: 'Fuel tank may crack',
      Consequence: 'Fuel leak',
      Remedy: 'Replace tank',
    };

    /**
     * Dispatch mocked responses by URL: the recall-side model list comes from
     * the products API; recallsByVehicle answers depend on the model param.
     */
    function mockNhtsaApis(opts: {
      recallSideModels?: string[];
      recallsByModel?: Record<string, unknown[]>;
      productsFail?: boolean;
    }) {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation((rawUrl: string) => {
        const url = new URL(rawUrl);
        if (url.pathname.startsWith('/products/')) {
          if (opts.productsFail) return Promise.reject(new TypeError('network down'));
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: (opts.recallSideModels ?? []).map((model) => ({ model })),
              }),
          });
        }
        const model = url.searchParams.get('model') ?? '';
        const results = opts.recallsByModel?.[model] ?? [];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ Count: results.length, results }),
        });
      });
    }

    it('finds recalls filed under the recall-side code when the stored vPIC name misses', async () => {
      mockNhtsaApis({
        recallSideModels: ['CRF1100 AFRICA TWIN', 'GL1800', 'CIVIC'],
        recallsByModel: { 'CRF1100 AFRICA TWIN': [CAMPAIGN] },
      });

      const recalls = await service.getRecalls({ make: 'Honda', model: 'Africa Twin', year: 2020 });

      expect(recalls).toHaveLength(1);
      expect(recalls[0].campaignNumber).toBe('20V797000');
    });

    it('finds recalls via curated alias when no string matching can bridge the names', async () => {
      mockNhtsaApis({
        recallSideModels: [],
        recallsByModel: { GL1800: [CAMPAIGN] },
      });

      const recalls = await service.getRecalls({ make: 'Honda', model: 'Gold Wing', year: 2020 });

      expect(recalls).toHaveLength(1);
    });

    it('dedupes the same campaign returned by multiple candidate queries', async () => {
      mockNhtsaApis({
        recallSideModels: ['CRF1100 AFRICA TWIN'],
        recallsByModel: {
          'Africa Twin': [CAMPAIGN],
          'CRF1100 AFRICA TWIN': [CAMPAIGN, CAMPAIGN],
        },
      });

      const recalls = await service.getRecalls({ make: 'Honda', model: 'Africa Twin', year: 2020 });

      expect(recalls).toHaveLength(1);
    });

    it('still returns stored-name results when the products API fails (non-fatal)', async () => {
      mockNhtsaApis({
        productsFail: true,
        recallsByModel: { 'Africa Twin': [CAMPAIGN] },
      });

      const recalls = await service.getRecalls({ make: 'Honda', model: 'Africa Twin', year: 2020 });

      expect(recalls).toHaveLength(1);
    });

    it('never calls the non-existent recallsByVin endpoint (it answers 403)', async () => {
      mockNhtsaApis({ recallsByModel: { 'Africa Twin': [CAMPAIGN] } });

      const recalls = await service.getRecalls({
        vin: 'JH2SC8210MK000000',
        make: 'Honda',
        model: 'Africa Twin',
        year: 2020,
      });

      expect(recalls).toHaveLength(1);
      const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(
        (call) => call[0] as string,
      );
      expect(urls.some((url) => url.includes('recallsByVin'))).toBe(false);
      // Stored make/model/year are complete, so the VIN is not decoded.
      expect(urls.some((url) => url.includes('DecodeVinValues'))).toBe(false);
    });

    it('fills a blank model and year from the VIN decoder', async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      mockNhtsaApis({ recallsByModel: { CRF1100L: [CAMPAIGN] } });
      const byUrl = fetchMock.getMockImplementation() as (url: string) => Promise<unknown>;
      fetchMock.mockImplementation((rawUrl: string) => {
        if (rawUrl.includes('DecodeVinValues')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                Results: [{ Make: 'HONDA', Model: 'CRF1100L', ModelYear: '2021' }],
              }),
          });
        }
        return byUrl(rawUrl);
      });

      const recalls = await service.getRecalls({
        vin: 'JH2SD1000MK000000',
        make: 'Honda',
        model: '',
      });

      expect(recalls).toHaveLength(1);
      const recallUrl = fetchMock.mock.calls
        .map((call) => call[0] as string)
        .find((url) => url.includes('recallsByVehicle'));
      expect(recallUrl).toContain('make=Honda');
      expect(recallUrl).toContain('modelYear=2021');
    });

    it('rejects with 422 (not a 503) when the bike has no model/year and no VIN', async () => {
      mockNhtsaApis({});

      await expect(
        service.getRecalls({ make: 'Honda', model: '', year: 2020 }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('rejects with 422 when the VIN cannot be decoded', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Results: [{ Make: '', Model: '', ModelYear: '' }] }),
      });

      await expect(
        service.getRecalls({ vin: 'NOTAREALVIN000000', make: 'Honda' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejects with 503 (not the 422) when the VIN decoder is down', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new TypeError('network down'),
      );

      await expect(
        service.getRecalls({ vin: 'JH2SD1000MK000000', make: 'Honda' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('rejects with 503 when the VIN decoder answers non-ok', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 502 });

      await expect(
        service.getRecalls({ vin: 'JH2SD1000MK000000', make: 'Honda' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('decodes a VIN once and serves the decode from cache afterwards', async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Results: [{ Make: '', Model: '', ModelYear: '' }] }),
      });

      for (let i = 0; i < 2; i++) {
        await expect(
          service.getRecalls({ vin: 'NOTAREALVIN000000', make: 'Honda' }),
        ).rejects.toBeInstanceOf(UnprocessableEntityException);
      }

      const decodeCalls = fetchMock.mock.calls.filter((call) =>
        (call[0] as string).includes('DecodeVinValues'),
      );
      expect(decodeCalls).toHaveLength(1);
    });

    /** Every call hangs until its abort timeout fires, like NHTSA on 2026-11-09. */
    function mockNhtsaHanging() {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      );
    }

    const fetchedUrls = () =>
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as string);

    const BIKE = { make: 'BMW', model: 'R 1200 GS', year: 2006 };

    it('answers a hanging NHTSA within the app timeout: no retry after a timeout (MOTO-VAULT-NODE-NESTJS-T)', async () => {
      mockNhtsaHanging();
      const startedAt = Date.now();

      const settled = service.getRecalls(BIKE).then(
        () => ({ error: undefined, at: Date.now() }),
        (error: unknown) => ({ error, at: Date.now() }),
      );
      await vi.advanceTimersByTimeAsync(40_000);
      const { error, at } = await settled;

      expect(error).toBeInstanceOf(UpstreamUnavailableException);
      // 5s products budget + 10s recalls budget, not 2 x 2 x 10s = 40s.
      expect(at - startedAt).toBeLessThan(20_000);
      const urls = fetchedUrls();
      expect(new Set(urls).size).toBe(urls.length);
    });

    it('fails fast while NHTSA is known to be down, then tries again after the cooldown', async () => {
      mockNhtsaHanging();
      const first = service.getRecalls(BIKE);
      const firstAssertion = expect(first).rejects.toBeInstanceOf(UpstreamUnavailableException);
      await vi.advanceTimersByTimeAsync(20_000);
      await firstAssertion;

      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockClear();
      await expect(service.getRecalls(BIKE)).rejects.toBeInstanceOf(UpstreamUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(61_000);
      mockNhtsaApis({ recallsByModel: { 'R 1200 GS': [CAMPAIGN] } });
      await expect(service.getRecalls(BIKE)).resolves.toHaveLength(1);
    });

    it('serves the expired recall list while NHTSA is down', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
      vi.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      mockNhtsaApis({ recallsByModel: { 'R 1200 GS': [CAMPAIGN] } });
      await service.getRecalls(BIKE);

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });

      const recalls = await service.getRecalls(BIKE);

      expect(recalls.map((recall) => recall.campaignNumber)).toEqual(['20V797000']);
    });

    it('joins a concurrent lookup for the same bike instead of querying NHTSA twice', async () => {
      mockNhtsaApis({ recallsByModel: { 'R 1200 GS': [CAMPAIGN] } });

      const [a, b] = await Promise.all([service.getRecalls(BIKE), service.getRecalls(BIKE)]);

      expect(a).toEqual(b);
      const urls = fetchedUrls();
      expect(new Set(urls).size).toBe(urls.length);
    });

    it('reports an upstream 4xx (our request is wrong) as a plain 503, not an outage', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 403 });

      const error = await service
        .getRecalls({ vin: 'JH2SD1000MK000000', make: 'Honda' })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error).not.toBeInstanceOf(UpstreamUnavailableException);
      // Deterministic answer: not retried.
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('serves cached results without re-fetching', async () => {
      mockNhtsaApis({ recallsByModel: { 'Africa Twin': [CAMPAIGN] } });
      await service.getRecalls({ make: 'Honda', model: 'Africa Twin', year: 2020 });

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockClear();
      const recalls = await service.getRecalls({ make: 'Honda', model: 'Africa Twin', year: 2020 });

      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(recalls).toHaveLength(1);
    });

    it('caches a lookup made without the recall-side model list only briefly, then runs the full lookup', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
      vi.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      const AFRICA_TWIN = { make: 'Honda', model: 'Africa Twin', year: 2020 };
      mockNhtsaApis({
        productsFail: true,
        recallsByModel: { 'CRF1100 AFRICA TWIN': [CAMPAIGN] },
      });
      await expect(service.getRecalls(AFRICA_TWIN)).resolves.toHaveLength(0);

      vi.advanceTimersByTime(61_000);
      mockNhtsaApis({
        recallSideModels: ['CRF1100 AFRICA TWIN'],
        recallsByModel: { 'CRF1100 AFRICA TWIN': [CAMPAIGN] },
      });
      const recalls = await service.getRecalls(AFRICA_TWIN);

      expect(recalls.map((recall) => recall.campaignNumber)).toEqual(['20V797000']);
    });

    it('keeps campaigns from the expired full lookup when the recall-side model list is down', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: test access to private logger
      vi.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
      const AFRICA_TWIN = { make: 'Honda', model: 'Africa Twin', year: 2020 };
      mockNhtsaApis({
        recallSideModels: ['CRF1100 AFRICA TWIN'],
        recallsByModel: { 'CRF1100 AFRICA TWIN': [CAMPAIGN] },
      });
      await service.getRecalls(AFRICA_TWIN);

      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      mockNhtsaApis({
        productsFail: true,
        recallsByModel: { 'CRF1100 AFRICA TWIN': [CAMPAIGN] },
      });
      const recalls = await service.getRecalls(AFRICA_TWIN);

      expect(recalls.map((recall) => recall.campaignNumber)).toEqual(['20V797000']);
    });

    it('fails fast for every VIN while the VIN decoder is down, not only the VIN that failed', async () => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockRejectedValue(new TypeError('network down'));
      await expect(
        service.getRecalls({ vin: 'JH2SD1000MK000000', make: 'Honda' }),
      ).rejects.toBeInstanceOf(UpstreamUnavailableException);

      fetchMock.mockClear();
      await expect(
        service.getRecalls({ vin: 'JH2SD1000MK000001', make: 'Honda' }),
      ).rejects.toBeInstanceOf(UpstreamUnavailableException);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
