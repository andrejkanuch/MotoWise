import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NhtsaService } from './nhtsa.service';

describe('NhtsaService', () => {
  let service: NhtsaService;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
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
});
