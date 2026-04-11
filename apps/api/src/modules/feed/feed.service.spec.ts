import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedService } from './feed.service';

describe('FeedService', () => {
  let service: FeedService;
  let mockUserClient: ReturnType<typeof createMockClient>;

  const userId = 'user-feed-1111-2222-3333-4444aaaabbbb';

  const fakeFollowRows = [
    { following_id: 'user-followed-aaa' },
    { following_id: 'user-followed-bbb' },
  ];

  const fakeRideRows = [
    {
      id: 'ride-feed-0001',
      name: 'Alpine Loop',
      distance_m: 85000,
      elevation_gain: 1200,
      elevation_loss: 1180,
      started_at: '2026-04-06T08:00:00Z',
      ended_at: '2026-04-06T11:30:00Z',
      ai_summary: 'A stunning ride through the alps with breathtaking views.',
      kudos_count: 12,
      route_thumbnail_uri: 'https://cdn.motovault.com/thumbs/ride-feed-0001.png',
      user_id: 'user-followed-aaa',
      motorcycle_id: 'moto-001',
      users: {
        display_name: 'Alice Rider',
        avatar_url: 'https://avatars.com/alice.jpg',
        public_username: 'alice_rides',
      },
      motorcycles: {
        make: 'Ducati',
        model: 'Monster 937',
        year: 2024,
        nickname: 'Red Devil',
      },
    },
    {
      id: 'ride-feed-0002',
      name: null,
      distance_m: 32000,
      elevation_gain: 150,
      elevation_loss: 145,
      started_at: '2026-04-05T14:00:00Z',
      ended_at: '2026-04-05T15:00:00Z',
      ai_summary: null,
      kudos_count: 3,
      route_thumbnail_uri: null,
      user_id: 'user-followed-bbb',
      motorcycle_id: null,
      users: {
        display_name: 'Bob Moto',
        avatar_url: null,
        public_username: 'bob_moto',
      },
      motorcycles: null,
    },
  ];

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

    service = new FeedService(mockUserClient as never);
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  describe('getRideFeed', () => {
    it('should return feed with rides from followed users and kudos batch', async () => {
      // Result 0: follows query (thenable)
      mockUserClient._pushResult({ data: fakeFollowRows });
      // Result 1: rides query (thenable)
      mockUserClient._pushResult({ data: fakeRideRows });
      // Result 2: kudos batch check (thenable)
      mockUserClient._pushResult({
        data: [{ ride_id: 'ride-feed-0001' }],
      });

      const result = await service.getRideFeed(userId, 20);

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].node.id).toBe('ride-feed-0001');
      expect(result.edges[0].node.rider.displayName).toBe('Alice Rider');
      expect(result.edges[0].node.bike?.make).toBe('Ducati');
      expect(result.edges[0].node.hasKudos).toBe(true);
      expect(result.edges[1].node.hasKudos).toBe(false);
      expect(result.edges[1].node.bike).toBeUndefined();
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should return empty feed when user follows nobody', async () => {
      mockUserClient._pushResult({ data: [] });

      const result = await service.getRideFeed(userId, 20);

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should return empty feed when followed users have no public rides', async () => {
      mockUserClient._pushResult({ data: fakeFollowRows });
      mockUserClient._pushResult({ data: [] });

      const result = await service.getRideFeed(userId, 20);

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should handle cursor pagination', async () => {
      const cursor = Buffer.from('2026-04-06T08:00:00Z').toString('base64');

      mockUserClient._pushResult({ data: fakeFollowRows });
      mockUserClient._pushResult({ data: [fakeRideRows[1]] });
      mockUserClient._pushResult({ data: [] });

      const result = await service.getRideFeed(userId, 20, cursor);

      expect(result.edges).toHaveLength(1);
      expect(result.pageInfo.hasPreviousPage).toBe(true);
      expect(mockUserClient._chain.lt).toHaveBeenCalledWith('started_at', '2026-04-06T08:00:00Z');
    });

    it('should throw BadRequestException for invalid cursor', async () => {
      const invalidCursor = Buffer.from('not-a-date').toString('base64');

      mockUserClient._pushResult({ data: fakeFollowRows });

      await expect(service.getRideFeed(userId, 20, invalidCursor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on follows lookup failure', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Connection error', code: '08006' },
      });

      await expect(service.getRideFeed(userId, 20)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
