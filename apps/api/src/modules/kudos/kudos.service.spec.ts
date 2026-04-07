import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KudosService } from './kudos.service';

describe('KudosService', () => {
  let service: KudosService;
  let mockUserClient: ReturnType<typeof createMockClient>;

  const userId = 'user-kudo-1111-2222-3333-4444aaaabbbb';
  const rideId = 'ride-abcd-1234-5678-9012-efgh3456ijkl';

  const fakeRidePublic = {
    is_public: true,
    deleted_at: null,
  };

  const fakeRidePrivate = {
    is_public: false,
    deleted_at: null,
  };

  const fakeRideDeleted = {
    is_public: true,
    deleted_at: '2026-04-06T12:00:00Z',
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

    service = new KudosService(mockUserClient as never);
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  describe('toggleKudos', () => {
    it('should give kudos (insert path) and return result', async () => {
      // Result 0: ride check (.single())
      mockUserClient._pushResult({ data: fakeRidePublic });
      // Result 1: upsert (thenable) — count > 0 means inserted
      mockUserClient._pushResult({ count: 1, error: null });
      // Result 2: fetch kudos_count (.single())
      mockUserClient._pushResult({ data: { kudos_count: 5 } });

      const result = await service.toggleKudos(rideId, userId);

      expect(result.hasKudos).toBe(true);
      expect(result.kudosCount).toBe(5);
      expect(mockUserClient.from).toHaveBeenCalledWith('rides');
      expect(mockUserClient.from).toHaveBeenCalledWith('ride_kudos');
    });

    it('should remove kudos (delete path) when already exists', async () => {
      // Result 0: ride check (.single())
      mockUserClient._pushResult({ data: fakeRidePublic });
      // Result 1: upsert (thenable) — count = 0 means already existed
      mockUserClient._pushResult({ count: 0, error: null });
      // Result 2: delete (thenable)
      mockUserClient._pushResult({ error: null });
      // Result 3: fetch kudos_count (.single())
      mockUserClient._pushResult({ data: { kudos_count: 3 } });

      const result = await service.toggleKudos(rideId, userId);

      expect(result.hasKudos).toBe(false);
      expect(result.kudosCount).toBe(3);
      expect(mockUserClient._chain.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for private ride', async () => {
      mockUserClient._pushResult({ data: fakeRidePrivate });

      await expect(service.toggleKudos(rideId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for deleted ride', async () => {
      mockUserClient._pushResult({ data: fakeRideDeleted });

      await expect(service.toggleKudos(rideId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when ride not found', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.toggleKudos(rideId, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getKudosList', () => {
    it('should return list of kudos users', async () => {
      const fakeKudosRows = [
        {
          user_id: 'user-aaa',
          created_at: '2026-04-07T10:00:00Z',
          users: {
            id: 'user-aaa',
            display_name: 'Alice Rider',
            avatar_url: 'https://avatars.com/alice.jpg',
            public_username: 'alice',
          },
        },
        {
          user_id: 'user-bbb',
          created_at: '2026-04-07T09:00:00Z',
          users: {
            id: 'user-bbb',
            display_name: 'Bob Rider',
            avatar_url: null,
            public_username: 'bob',
          },
        },
      ];

      mockUserClient._pushResult({ data: fakeKudosRows });

      const result = await service.getKudosList(rideId, 20);

      expect(result.users).toHaveLength(2);
      expect(result.users[0].displayName).toBe('Alice Rider');
      expect(result.users[1].avatarUrl).toBeUndefined();
      expect(result.hasNextPage).toBe(false);
    });

    it('should return empty list when no kudos', async () => {
      mockUserClient._pushResult({ data: [] });

      const result = await service.getKudosList(rideId, 20);

      expect(result.users).toHaveLength(0);
      expect(result.hasNextPage).toBe(false);
    });

    it('should throw BadRequestException for invalid cursor', async () => {
      const invalidCursor = Buffer.from('not-a-date').toString('base64');

      await expect(service.getKudosList(rideId, 20, invalidCursor)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect hasNextPage when more results than limit', async () => {
      // Request limit=2, return 3 rows to trigger hasNextPage
      const rows = [
        {
          user_id: 'user-1',
          created_at: '2026-04-07T10:00:00Z',
          users: { id: 'user-1', display_name: 'U1', avatar_url: null, public_username: 'u1' },
        },
        {
          user_id: 'user-2',
          created_at: '2026-04-07T09:00:00Z',
          users: { id: 'user-2', display_name: 'U2', avatar_url: null, public_username: 'u2' },
        },
        {
          user_id: 'user-3',
          created_at: '2026-04-07T08:00:00Z',
          users: { id: 'user-3', display_name: 'U3', avatar_url: null, public_username: 'u3' },
        },
      ];
      mockUserClient._pushResult({ data: rows });

      const result = await service.getKudosList(rideId, 2);

      expect(result.users).toHaveLength(2);
      expect(result.hasNextPage).toBe(true);
    });
  });
});
