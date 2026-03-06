import { InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSupabaseClient } from '../../../test/helpers/supabase-mock';
import { LearningProgressService } from './learning-progress.service';

describe('LearningProgressService', () => {
  let service: LearningProgressService;
  let userMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    userMock = createMockSupabaseClient();
    service = new LearningProgressService(userMock.client as any);
  });

  describe('findByUser', () => {
    it('should return learning progress mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: [
          {
            id: 'lp1',
            user_id: 'u1',
            article_id: 'a1',
            article_read: true,
            quiz_completed: false,
            quiz_best_score: null,
            first_read_at: '2025-01-01T00:00:00Z',
            last_read_at: '2025-01-02T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await service.findByUser('u1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'lp1',
        userId: 'u1',
        articleId: 'a1',
        articleRead: true,
        quizCompleted: false,
        quizBestScore: null,
        firstReadAt: '2025-01-01T00:00:00Z',
        lastReadAt: '2025-01-02T00:00:00Z',
      });
      expect(userMock.client.from).toHaveBeenCalledWith('learning_progress');
    });

    it('should return empty array when data is null', async () => {
      userMock.queryBuilder.resolveWith({ data: null, error: null });

      const result = await service.findByUser('u1');
      expect(result).toEqual([]);
    });

    it('should throw InternalServerErrorException on error', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'db error' },
      });

      await expect(service.findByUser('u1')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('markRead', () => {
    it('should upsert and return progress when first_read_at already exists', async () => {
      userMock.queryBuilder.resolveWith({
        data: {
          id: 'lp1',
          user_id: 'u1',
          article_id: 'a1',
          article_read: true,
          quiz_completed: false,
          quiz_best_score: null,
          first_read_at: '2025-01-01T00:00:00Z',
          last_read_at: '2025-01-05T00:00:00Z',
        },
        error: null,
      });

      const result = await service.markRead('u1', 'a1');

      expect(result.articleRead).toBe(true);
      expect(result.firstReadAt).toBe('2025-01-01T00:00:00Z');
      expect(userMock.queryBuilder.upsert).toHaveBeenCalled();
    });

    it('should set first_read_at on newly inserted rows', async () => {
      let callCount = 0;
      userMock.queryBuilder.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: upsert returns row with null first_read_at
          return Promise.resolve({
            data: {
              id: 'lp2',
              user_id: 'u1',
              article_id: 'a2',
              article_read: true,
              quiz_completed: false,
              quiz_best_score: null,
              first_read_at: null,
              last_read_at: '2025-01-05T00:00:00Z',
            },
            error: null,
          });
        }
        // Second call: update sets first_read_at
        return Promise.resolve({
          data: {
            id: 'lp2',
            user_id: 'u1',
            article_id: 'a2',
            article_read: true,
            quiz_completed: false,
            quiz_best_score: null,
            first_read_at: '2025-01-05T00:00:00Z',
            last_read_at: '2025-01-05T00:00:00Z',
          },
          error: null,
        });
      });

      const result = await service.markRead('u1', 'a2');

      expect(result.firstReadAt).toBe('2025-01-05T00:00:00Z');
      expect(userMock.queryBuilder.update).toHaveBeenCalled();
      expect(userMock.queryBuilder.is).toHaveBeenCalledWith('first_read_at', null);
    });

    it('should throw InternalServerErrorException when upsert fails', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'upsert failed' },
      });

      await expect(service.markRead('u1', 'a1')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when first_read_at update fails', async () => {
      let callCount = 0;
      userMock.queryBuilder.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              id: 'lp2',
              user_id: 'u1',
              article_id: 'a2',
              article_read: true,
              quiz_completed: false,
              quiz_best_score: null,
              first_read_at: null,
              last_read_at: '2025-01-05T00:00:00Z',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: { message: 'update failed' } });
      });

      await expect(service.markRead('u1', 'a2')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
