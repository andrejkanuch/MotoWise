import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSupabaseClient } from '../../../test/helpers/supabase-mock';
import { MotorcyclesService } from './motorcycles.service';

describe('MotorcyclesService', () => {
  let service: MotorcyclesService;
  let userMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    userMock = createMockSupabaseClient();
    service = new MotorcyclesService(userMock.client as any);
  });

  describe('findByUser', () => {
    it('should return motorcycles mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: [
          {
            id: 'm1',
            user_id: 'u1',
            make: 'Honda',
            model: 'CB500F',
            year: 2023,
            nickname: 'Red',
            is_primary: true,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await service.findByUser('u1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'm1',
        userId: 'u1',
        make: 'Honda',
        model: 'CB500F',
        year: 2023,
        nickname: 'Red',
        isPrimary: true,
        createdAt: '2025-01-01T00:00:00Z',
      });
      expect(userMock.client.from).toHaveBeenCalledWith('motorcycles');
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
    it('should create and return a motorcycle mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: {
          id: 'm2',
          user_id: 'u1',
          make: 'Yamaha',
          model: 'MT-07',
          year: 2024,
          nickname: null,
          is_primary: false,
          created_at: '2025-02-01T00:00:00Z',
        },
        error: null,
      });

      const result = await service.create('u1', {
        make: 'Yamaha',
        model: 'MT-07',
        year: 2024,
      });

      expect(result.userId).toBe('u1');
      expect(result.make).toBe('Yamaha');
      expect(result.isPrimary).toBe(false);
      expect(userMock.queryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'u1',
        make: 'Yamaha',
        model: 'MT-07',
        year: 2024,
        nickname: undefined,
      });
    });

    it('should throw BadRequestException when creation fails', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'insert failed' },
      });

      await expect(
        service.create('u1', { make: 'Honda', model: 'CB500F', year: 2023 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
