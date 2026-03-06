import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSupabaseClient } from '../../../test/helpers/supabase-mock';
import { ContentFlagsService } from './content-flags.service';

describe('ContentFlagsService', () => {
  let service: ContentFlagsService;
  let userMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    userMock = createMockSupabaseClient();
    service = new ContentFlagsService(userMock.client as any);
  });

  describe('create', () => {
    it('should create and return a content flag mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: {
          id: 'cf1',
          article_id: 'a1',
          user_id: 'u1',
          section_reference: 'section-2',
          comment: 'Incorrect info about tire pressure',
          status: 'open',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.create('u1', {
        articleId: 'a1',
        sectionReference: 'section-2',
        comment: 'Incorrect info about tire pressure',
      });

      expect(result).toEqual({
        id: 'cf1',
        articleId: 'a1',
        userId: 'u1',
        sectionReference: 'section-2',
        comment: 'Incorrect info about tire pressure',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
      });
      expect(userMock.client.from).toHaveBeenCalledWith('content_flags');
      expect(userMock.queryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'u1',
        article_id: 'a1',
        section_reference: 'section-2',
        comment: 'Incorrect info about tire pressure',
      });
    });

    it('should handle missing sectionReference', async () => {
      userMock.queryBuilder.resolveWith({
        data: {
          id: 'cf2',
          article_id: 'a1',
          user_id: 'u1',
          section_reference: undefined,
          comment: 'General feedback',
          status: 'open',
          created_at: '2025-01-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.create('u1', {
        articleId: 'a1',
        comment: 'General feedback',
      });

      expect(result.sectionReference).toBeUndefined();
    });

    it('should throw when creation fails', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'insert failed' },
      });

      await expect(
        service.create('u1', { articleId: 'a1', comment: 'Bad content' }),
      ).rejects.toThrow('Failed to create flag');
    });
  });
});
