import { InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSupabaseClient } from '../../../test/helpers/supabase-mock';
import { ArticlesService } from './articles.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let adminMock: ReturnType<typeof createMockSupabaseClient>;
  let userMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    adminMock = createMockSupabaseClient();
    userMock = createMockSupabaseClient();
    service = new ArticlesService(adminMock.client as any, userMock.client as any);
  });

  describe('search', () => {
    const sampleRow = {
      id: 'a1',
      slug: 'chain-maintenance',
      title: 'Chain Maintenance',
      difficulty: 'beginner',
      category: 'maintenance',
      view_count: 42,
      is_safety_critical: false,
      generated_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    };

    it('should return articles with pagination info', async () => {
      adminMock.queryBuilder.resolveWith({
        data: [sampleRow],
        error: null,
        count: 1,
      });

      const result = await service.search({});

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node).toEqual({
        id: 'a1',
        slug: 'chain-maintenance',
        title: 'Chain Maintenance',
        difficulty: 'beginner',
        category: 'maintenance',
        viewCount: 42,
        isSafetyCritical: false,
        generatedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });
      expect(result.totalCount).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(adminMock.client.from).toHaveBeenCalledWith('articles');
    });

    it('should detect hasNextPage when more rows than limit', async () => {
      const rows = Array.from({ length: 3 }, (_, i) => ({
        ...sampleRow,
        id: `a${i}`,
        generated_at: `2025-01-0${i + 1}T00:00:00Z`,
      }));

      adminMock.queryBuilder.resolveWith({
        data: rows,
        error: null,
        count: 10,
      });

      const result = await service.search({ first: 2 });

      expect(result.edges).toHaveLength(2);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it('should throw InternalServerErrorException on error', async () => {
      adminMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'db error' },
      });

      await expect(service.search({})).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('findBySlug', () => {
    it('should return an article mapped to camelCase', async () => {
      adminMock.queryBuilder.resolveWith({
        data: {
          id: 'a1',
          slug: 'tire-pressure',
          title: 'Tire Pressure',
          difficulty: 'beginner',
          category: 'safety',
          view_count: 10,
          is_safety_critical: true,
          generated_at: '2025-03-01T00:00:00Z',
          updated_at: '2025-03-02T00:00:00Z',
        },
        error: null,
      });

      const result = await service.findBySlug('tire-pressure');

      expect(result).not.toBeNull();
      expect(result!.isSafetyCritical).toBe(true);
      expect(result!.viewCount).toBe(10);
    });

    it('should return null when article not found', async () => {
      adminMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'not found', code: 'PGRST116' },
      });

      const result = await service.findBySlug('nonexistent');
      expect(result).toBeNull();
    });
  });
});
