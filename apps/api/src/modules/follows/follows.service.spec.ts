import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  let service: FollowsService;
  let mockUserClient: ReturnType<typeof createMockClient>;

  const currentUserId = 'user-aaaa1111-bbbb-cccc-dddd-eeee2222ffff';
  const targetUserId = 'user-3333aaaa-4444-5555-6666-7777bbbb8888';

  const fakeFollowRow = {
    follower_id: currentUserId,
    following_id: targetUserId,
    created_at: '2026-04-07T10:00:00Z',
  };

  const fakePublicUser = {
    id: targetUserId,
    is_public: true,
  };

  const fakePrivateUser = {
    id: targetUserId,
    is_public: false,
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
    mockUserClient = createMockClient();

    service = new FollowsService(mockUserClient as never);
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  describe('follow', () => {
    it('should follow a public user and return mapped follow', async () => {
      // Result 0: user lookup (.single())
      mockUserClient._pushResult({ data: fakePublicUser });
      // Result 1: insert follow (.single())
      mockUserClient._pushResult({ data: fakeFollowRow });

      const result = await service.follow(currentUserId, targetUserId);

      expect(result.followerId).toBe(currentUserId);
      expect(result.followingId).toBe(targetUserId);
      expect(result.createdAt).toBe('2026-04-07T10:00:00Z');
      expect(mockUserClient.from).toHaveBeenCalledWith('users');
      expect(mockUserClient.from).toHaveBeenCalledWith('follows');
    });

    it('should throw BadRequestException when trying to follow yourself', async () => {
      await expect(service.follow(currentUserId, currentUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException when target profile is private', async () => {
      mockUserClient._pushResult({ data: fakePrivateUser });

      await expect(service.follow(currentUserId, targetUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException on duplicate follow (23505)', async () => {
      mockUserClient._pushResult({ data: fakePublicUser });
      mockUserClient._pushResult({
        data: null,
        error: { message: 'duplicate key', code: '23505' },
      });

      await expect(service.follow(currentUserId, targetUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when target user not found', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.follow(currentUserId, targetUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('unfollow', () => {
    it('should unfollow and return true', async () => {
      mockUserClient._pushResult({ data: { follower_id: currentUserId } });

      const result = await service.unfollow(currentUserId, targetUserId);

      expect(result).toBe(true);
      expect(mockUserClient.from).toHaveBeenCalledWith('follows');
      expect(mockUserClient._chain.delete).toHaveBeenCalled();
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('follower_id', currentUserId);
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('following_id', targetUserId);
    });

    it('should throw BadRequestException when not following', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.unfollow(currentUserId, targetUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getFollowers', () => {
    it('should return paginated follower connection', async () => {
      // Result 0: assertProfileVisible — user lookup (.single())
      mockUserClient._pushResult({ data: fakePublicUser });
      // Result 1: followers query (thenable) — returns data + count
      mockUserClient._pushResult({
        data: [fakeFollowRow, { ...fakeFollowRow, follower_id: 'user-other-id-1234' }],
        count: 2,
      });
      // Result 2: fetchUserDisplayInfo (thenable)
      mockUserClient._pushResult({
        data: [
          {
            id: currentUserId,
            display_name: 'John',
            public_username: 'john_rider',
            avatar_url: null,
          },
          {
            id: 'user-other-id-1234',
            display_name: 'Jane',
            public_username: 'jane_rider',
            avatar_url: 'https://avatars.com/jane.jpg',
          },
        ],
      });

      const result = await service.getFollowers(currentUserId, targetUserId, 20);

      expect(result.edges).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it('should return empty result when no followers', async () => {
      mockUserClient._pushResult({ data: fakePublicUser });
      mockUserClient._pushResult({ data: [], count: 0 });

      const result = await service.getFollowers(currentUserId, targetUserId, 20);

      expect(result.edges).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should throw ForbiddenException for private profile', async () => {
      mockUserClient._pushResult({ data: fakePrivateUser });

      await expect(
        service.getFollowers(currentUserId, targetUserId, 20),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid cursor', async () => {
      mockUserClient._pushResult({ data: fakePublicUser });

      const invalidCursor = Buffer.from('not-a-date').toString('base64');

      await expect(
        service.getFollowers(currentUserId, targetUserId, 20, invalidCursor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFollowing', () => {
    it('should return paginated following connection', async () => {
      // Result 0: assertProfileVisible — same user (skipped) so we query follows
      // When currentUserId === userId, assertProfileVisible returns early
      // Result 0: follows query (thenable)
      mockUserClient._pushResult({
        data: [
          {
            follower_id: currentUserId,
            following_id: targetUserId,
            created_at: '2026-04-07T10:00:00Z',
          },
        ],
        count: 1,
      });
      // Result 1: fetchUserDisplayInfo (thenable)
      mockUserClient._pushResult({
        data: [
          {
            id: targetUserId,
            display_name: 'Target User',
            public_username: 'target_rider',
            avatar_url: null,
          },
        ],
      });

      const result = await service.getFollowing(currentUserId, currentUserId, 20);

      expect(result.edges).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.edges[0].node.followingId).toBe(targetUserId);
    });
  });
});
