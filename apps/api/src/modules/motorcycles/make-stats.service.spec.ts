import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MakeStatsService } from './make-stats.service';

describe('MakeStatsService', () => {
  let service: MakeStatsService;
  let mockAdminClient: { rpc: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient = { rpc: vi.fn() };
    service = new MakeStatsService(mockAdminClient as never);
  });

  it('should return ranked stats from RPC', async () => {
    const rpcData = [
      { make: 'Bmw', riders: 22, distinct_models: 12, total_bikes: 25 },
      { make: 'Honda', riders: 19, distinct_models: 17, total_bikes: 20 },
      { make: 'Kawasaki', riders: 8, distinct_models: 8, total_bikes: 10 },
    ];
    mockAdminClient.rpc.mockResolvedValue({ data: rpcData, error: null });

    const result = await service.getMakeStats();

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ make: 'Bmw', riders: 22, models: 12, totalBikes: 25, rank: 1 });
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
  });

  it('should return empty array when RPC fails', async () => {
    mockAdminClient.rpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    expect(await service.getMakeStats()).toEqual([]);
  });

  it('should return empty array when no data', async () => {
    mockAdminClient.rpc.mockResolvedValue({ data: [], error: null });
    expect(await service.getMakeStats()).toEqual([]);
  });

  it('should cache results across calls (TTL) — RPC hit only once', async () => {
    // Proves the cache works now that the service is a singleton (audit H16).
    mockAdminClient.rpc.mockResolvedValue({
      data: [{ make: 'Bmw', riders: 1, distinct_models: 1, total_bikes: 1 }],
      error: null,
    });

    await service.getMakeStats();
    await service.getMakeStats();

    expect(mockAdminClient.rpc).toHaveBeenCalledTimes(1);
  });
});
