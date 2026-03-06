import { InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSupabaseClient } from '../../../test/helpers/supabase-mock';
import { DiagnosticsService } from './diagnostics.service';

describe('DiagnosticsService', () => {
  let service: DiagnosticsService;
  let userMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    userMock = createMockSupabaseClient();
    service = new DiagnosticsService(userMock.client as any);
  });

  describe('findByUser', () => {
    it('should return diagnostics mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: [
          {
            id: 'd1',
            user_id: 'u1',
            motorcycle_id: 'm1',
            severity: 'medium',
            confidence: 0.85,
            related_article_id: 'a1',
            data_sharing_opted_in: true,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await service.findByUser('u1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'd1',
        userId: 'u1',
        motorcycleId: 'm1',
        severity: 'medium',
        confidence: 0.85,
        relatedArticleId: 'a1',
        dataSharingOptedIn: true,
        createdAt: '2025-01-01T00:00:00Z',
      });
      expect(userMock.client.from).toHaveBeenCalledWith('diagnostics');
      expect(userMock.queryBuilder.eq).toHaveBeenCalledWith('user_id', 'u1');
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

  describe('create', () => {
    it('should create and return a diagnostic mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: {
          id: 'd2',
          user_id: 'u1',
          motorcycle_id: 'm1',
          severity: null,
          confidence: null,
          related_article_id: null,
          data_sharing_opted_in: false,
          created_at: '2025-02-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.create('u1', {
        motorcycleId: 'm1',
        dataSharingOptedIn: false,
      });

      expect(result.motorcycleId).toBe('m1');
      expect(result.dataSharingOptedIn).toBe(false);
      expect(userMock.queryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'u1',
        motorcycle_id: 'm1',
        result_json: {},
        wizard_answers: null,
        data_sharing_opted_in: false,
      });
    });

    it('should throw InternalServerErrorException when creation fails', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'insert failed' },
      });

      await expect(
        service.create('u1', { motorcycleId: 'm1', dataSharingOptedIn: true }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
