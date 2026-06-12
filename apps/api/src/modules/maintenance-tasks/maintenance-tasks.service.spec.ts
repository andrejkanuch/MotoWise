import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpensesService } from '../expenses/expenses.service';
import { MaintenanceTasksService } from './maintenance-tasks.service';

describe('MaintenanceTasksService', () => {
  let service: MaintenanceTasksService;
  let mockUserClient: ReturnType<typeof createMockClient>;
  let mockAdminClient: ReturnType<typeof createMockClient>;
  let mockExpensesService: { createFromTask: ReturnType<typeof vi.fn> };

  const userId = 'user-123';
  const motorcycleId = 'moto-456';
  const taskId = 'task-789';

  const fakeRow = {
    id: taskId,
    user_id: userId,
    motorcycle_id: motorcycleId,
    title: 'Oil Change',
    description: null,
    due_date: '2026-04-01',
    target_mileage: 10000,
    priority: 'medium',
    status: 'pending',
    notes: null,
    parts_needed: null,
    completed_at: null,
    completed_mileage: null,
    cost: null,
    parts_cost: null,
    labor_cost: null,
    currency: null,
    source: 'user',
    oem_schedule_id: null,
    interval_km: null,
    interval_days: null,
    is_recurring: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
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
      'eq',
      'in',
      'is',
      'not',
      'gte',
      'order',
      'limit',
    ]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.single = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
    // Make the chain thenable so queries without .single() also resolve
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
      storage: {
        from: vi.fn().mockReturnValue({
          remove: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
      _chain: chain,
      _pushResult: pushResult,
      _resetIndex: resetIndex,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClient = createMockClient();
    mockAdminClient = createMockClient();
    mockExpensesService = {
      createFromTask: vi.fn().mockResolvedValue(undefined),
    };
    const mockConfigService = {
      getOrThrow: vi.fn().mockReturnValue('https://test.supabase.co'),
    } as unknown as ConfigService;

    service = new MaintenanceTasksService(
      mockUserClient as never,
      mockAdminClient as never,
      mockConfigService,
      mockExpensesService as unknown as ExpensesService,
    );
  });

  describe('findAllForUser', () => {
    it('should return mapped tasks filtered by pending/in_progress', async () => {
      // First query: active motorcycles
      mockUserClient._pushResult({
        data: [{ id: motorcycleId }],
      });
      // Second query: maintenance tasks for those bikes
      mockUserClient._pushResult({
        data: [fakeRow, { ...fakeRow, id: 'task-2', status: 'in_progress' }],
      });

      const result = await service.findAllForUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(taskId);
      expect(result[0].title).toBe('Oil Change');
    });
  });

  describe('findByMotorcycle', () => {
    it('should scope by motorcycle_id', async () => {
      mockUserClient._pushResult({ data: [fakeRow] });

      const result = await service.findByMotorcycle(userId, motorcycleId);

      expect(result).toHaveLength(1);
      expect(result[0].motorcycleId).toBe(motorcycleId);
      expect(mockUserClient._chain.eq).toHaveBeenCalledWith('motorcycle_id', motorcycleId);
    });
  });

  describe('create', () => {
    it('should insert with default priority medium when not provided', async () => {
      mockUserClient._pushResult({ data: fakeRow });

      const result = await service.create(userId, {
        motorcycleId,
        title: 'Oil Change',
      });

      expect(result.priority).toBe('medium');
      expect(mockUserClient._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'medium' }),
      );
    });
  });

  describe('complete', () => {
    it('should transition status to completed and set completed_at', async () => {
      const completedRow = {
        ...fakeRow,
        status: 'completed',
        completed_at: '2026-03-20T00:00:00Z',
      };
      mockUserClient._pushResult({ data: completedRow });

      const result = await service.complete(userId, taskId);

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBe('2026-03-20T00:00:00Z');
      expect(mockUserClient._chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completed_at: expect.any(String),
        }),
      );
    });

    it('should fire auto-expense creation when totalCost > 0', async () => {
      const completedRow = {
        ...fakeRow,
        status: 'completed',
        completed_at: '2026-03-20T00:00:00Z',
        cost: 50,
        parts_cost: 30,
        labor_cost: 20,
      };
      mockUserClient._pushResult({ data: completedRow });

      await service.complete(userId, taskId, { cost: 50, partsCost: 30, laborCost: 20 });

      expect(mockExpensesService.createFromTask).toHaveBeenCalledWith(
        userId,
        motorcycleId,
        taskId,
        100, // 50 + 30 + 20
        'Oil Change',
      );
    });

    it('should throw BadRequestException for already-completed task (not found by status filter)', async () => {
      mockUserClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.complete(userId, taskId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createNextRecurrence', () => {
    it('should calculate next due date from intervalDays', async () => {
      const completedTask = {
        id: taskId,
        userId,
        motorcycleId,
        title: 'Oil Change',
        priority: 'medium',
        status: 'completed',
        source: 'user',
        isRecurring: true,
        intervalDays: 90,
        completedAt: '2026-01-01T00:00:00Z',
        completedMileage: undefined,
        intervalKm: undefined,
        description: undefined,
        oemScheduleId: undefined,
        photos: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      // createNextRecurrence writes via the RLS-enforcing user client (not admin).
      mockUserClient._pushResult({
        data: { ...fakeRow, is_recurring: true, due_date: '2026-04-01T00:00:00.000Z' },
      });

      await service.createNextRecurrence(completedTask as never);

      expect(mockUserClient._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          due_date: expect.any(String),
          is_recurring: true,
        }),
      );

      const insertArg = mockUserClient._chain.insert.mock.calls[0][0];
      const dueDate = new Date(insertArg.due_date);
      const completedDate = new Date('2026-01-01T00:00:00Z');
      const diffDays = Math.round(
        (dueDate.getTime() - completedDate.getTime()) / (24 * 60 * 60 * 1000),
      );
      expect(diffDays).toBe(90);
    });

    it('should calculate next target mileage from intervalKm', async () => {
      const completedTask = {
        id: taskId,
        userId,
        motorcycleId,
        title: 'Oil Change',
        priority: 'medium',
        status: 'completed',
        source: 'user',
        isRecurring: true,
        intervalKm: 5000,
        completedMileage: 20000,
        completedAt: '2026-01-01T00:00:00Z',
        intervalDays: undefined,
        description: undefined,
        oemScheduleId: undefined,
        photos: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockUserClient._pushResult({
        data: { ...fakeRow, is_recurring: true, target_mileage: 25000 },
      });

      await service.createNextRecurrence(completedTask as never);

      expect(mockUserClient._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          target_mileage: 25000,
        }),
      );
    });

    it('should return null if task is not recurring', async () => {
      const nonRecurringTask = {
        id: taskId,
        userId,
        motorcycleId,
        title: 'Oil Change',
        priority: 'medium',
        status: 'completed',
        source: 'user',
        isRecurring: false,
        photos: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const result = await service.createNextRecurrence(nonRecurringTask as never);

      expect(result).toBeNull();
      expect(mockAdminClient.from).not.toHaveBeenCalled();
      expect(mockUserClient.from).not.toHaveBeenCalled();
    });

    it('logs the error and returns null when the insert fails (no silent swallow)', async () => {
      const completedTask = {
        id: taskId,
        userId,
        motorcycleId,
        title: 'Oil Change',
        priority: 'medium',
        status: 'completed',
        source: 'user',
        isRecurring: true,
        intervalDays: 90,
        completedAt: '2026-01-01T00:00:00Z',
        photos: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const loggerError = vi
        .spyOn((service as unknown as { logger: { error: () => void } }).logger, 'error')
        .mockImplementation(() => undefined);
      mockUserClient._pushResult({ data: null, error: { message: 'insert blew up', code: '500' } });

      const result = await service.createNextRecurrence(completedTask as never);

      expect(result).toBeNull();
      expect(loggerError).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should call RPC and return true on success', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await service.softDelete(userId, taskId);

      expect(result).toBe(true);
      expect(mockUserClient.rpc).toHaveBeenCalledWith('soft_delete_maintenance_task', {
        task_id: taskId,
      });
    });

    it('should throw NotFoundException when RPC returns false', async () => {
      mockUserClient.rpc.mockResolvedValueOnce({ data: false, error: null });

      await expect(service.softDelete(userId, taskId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addPhoto', () => {
    it('should enforce 5-photo limit', async () => {
      // Result 0: task ownership check (.single()) — passes
      mockAdminClient._pushResult({ data: { id: taskId } });
      // Result 1: count query (thenable, no .single()) — returns count=5
      mockAdminClient._pushResult({ count: 5 });

      await expect(service.addPhoto(userId, taskId, 'photos/test.webp')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for wrong user (task ownership check fails)', async () => {
      // Result 0: task ownership check fails
      mockAdminClient._pushResult({
        data: null,
        error: { message: 'Row not found', code: 'PGRST116' },
      });

      await expect(service.addPhoto(userId, taskId, 'photos/test.webp')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deletePhoto', () => {
    it('should verify ownership via task lookup', async () => {
      // Result 0: photo lookup succeeds (.single())
      mockAdminClient._pushResult({
        data: { id: 'photo-1', task_id: taskId, storage_path: 'photos/test.webp' },
      });
      // Result 1: task ownership fails (.single())
      mockAdminClient._pushResult({
        data: null,
        error: { message: 'Row not found' },
      });

      await expect(service.deletePhoto(userId, 'photo-1')).rejects.toThrow(NotFoundException);

      // Verify it looked up the task with user_id
      expect(mockAdminClient._chain.eq).toHaveBeenCalledWith('user_id', userId);
    });
  });
});
