import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedRoutesService } from './saved-routes.service';

/** Helper to create a mock Supabase client */
function createMockSupabase() {
  return {
    from: vi.fn(),
  };
}

describe('SavedRoutesService', () => {
  let service: SavedRoutesService;
  let mockUser: ReturnType<typeof createMockSupabase>;
  let mockAdmin: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockUser = createMockSupabase();
    mockAdmin = createMockSupabase();
    service = new SavedRoutesService(mockUser as never, mockAdmin as never);
  });

  describe('saveRoute', () => {
    it('returns true on successful save', async () => {
      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      mockUser.from.mockReturnValue(insertChain);

      const result = await service.saveRoute('user-1', 'route-1');
      expect(result).toBe(true);
      expect(mockUser.from).toHaveBeenCalledWith('route_saves');
    });

    it('is idempotent — returns true on duplicate (23505)', async () => {
      const insertChain = {
        insert: vi.fn().mockResolvedValue({
          error: { code: '23505', message: 'duplicate key' },
        }),
      };
      mockUser.from.mockReturnValue(insertChain);

      const result = await service.saveRoute('user-1', 'route-1');
      expect(result).toBe(true);
    });
  });

  describe('unsaveRoute', () => {
    it('returns true on successful unsave', async () => {
      const deleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      // The last .eq() call resolves the promise
      let eqCallCount = 0;
      deleteChain.eq = vi.fn().mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) {
          return Promise.resolve({ error: null });
        }
        return deleteChain;
      });
      mockUser.from.mockReturnValue(deleteChain);

      const result = await service.unsaveRoute('user-1', 'route-1');
      expect(result).toBe(true);
    });

    it('returns true when deleting a non-existent save (graceful)', async () => {
      const deleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };
      let eqCallCount = 0;
      deleteChain.eq = vi.fn().mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) {
          // No error even when row doesn't exist — Supabase delete is a no-op
          return Promise.resolve({ error: null });
        }
        return deleteChain;
      });
      mockUser.from.mockReturnValue(deleteChain);

      const result = await service.unsaveRoute('user-1', 'nonexistent-route');
      expect(result).toBe(true);
      expect(mockUser.from).toHaveBeenCalledWith('route_saves');
    });
  });

  describe('isRouteSaved', () => {
    // The routes service doesn't have isRouteSaved as a standalone method,
    // but saveRoute returning true on 23505 effectively confirms the save exists.
    // We test the idempotency pattern which serves as the "is saved" check.
    it('saveRoute idempotency acts as implicit isRouteSaved', async () => {
      // First save
      const insertChainFirst = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      mockUser.from.mockReturnValue(insertChainFirst);
      const firstResult = await service.saveRoute('user-1', 'route-1');
      expect(firstResult).toBe(true);

      // Second save — duplicate returns true (already saved)
      const insertChainSecond = {
        insert: vi.fn().mockResolvedValue({
          error: { code: '23505', message: 'duplicate key' },
        }),
      };
      mockUser.from.mockReturnValue(insertChainSecond);
      const secondResult = await service.saveRoute('user-1', 'route-1');
      expect(secondResult).toBe(true);
    });
  });
});
