import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockSupabaseClient } from '../../../test/helpers/supabase-mock';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    userMock = createMockSupabaseClient();
    service = new UsersService(userMock.client as any);
  });

  describe('findById', () => {
    it('should return a user mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: {
          id: 'u1',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'rider',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
        error: null,
      });

      const result = await service.findById('u1');

      expect(result).toEqual({
        id: 'u1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'rider',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      });
      expect(userMock.client.from).toHaveBeenCalledWith('users');
      expect(userMock.queryBuilder.eq).toHaveBeenCalledWith('id', 'u1');
      expect(userMock.queryBuilder.single).toHaveBeenCalled();
    });

    it('should throw NotFoundException when Supabase returns an error', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when data is null', async () => {
      userMock.queryBuilder.resolveWith({ data: null, error: null });

      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the user mapped to camelCase', async () => {
      userMock.queryBuilder.resolveWith({
        data: {
          id: 'u1',
          email: 'test@example.com',
          full_name: 'Updated Name',
          role: 'rider',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-03T00:00:00Z',
        },
        error: null,
      });

      const result = await service.update('u1', { fullName: 'Updated Name' });

      expect(result.fullName).toBe('Updated Name');
      expect(userMock.queryBuilder.update).toHaveBeenCalledWith({ full_name: 'Updated Name' });
      expect(userMock.queryBuilder.eq).toHaveBeenCalledWith('id', 'u1');
    });

    it('should throw NotFoundException when update fails', async () => {
      userMock.queryBuilder.resolveWith({
        data: null,
        error: { message: 'update failed' },
      });

      await expect(service.update('u1', { fullName: 'X' })).rejects.toThrow(NotFoundException);
    });
  });
});
