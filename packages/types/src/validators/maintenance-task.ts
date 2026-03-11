import { z } from 'zod';

export const CreateMaintenanceTaskSchema = z.object({
  motorcycleId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  targetMileage: z.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  notes: z.string().max(2000).optional(),
  partsNeeded: z.array(z.string().max(100)).max(20).optional(),
});
export type CreateMaintenanceTask = z.infer<typeof CreateMaintenanceTaskSchema>;

export const UpdateMaintenanceTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .nullable()
    .optional(),
  targetMileage: z.number().int().positive().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  notes: z.string().max(2000).nullable().optional(),
  partsNeeded: z.array(z.string().max(100)).max(20).nullable().optional(),
});
export type UpdateMaintenanceTask = z.infer<typeof UpdateMaintenanceTaskSchema>;

export const MaintenanceTaskCostSchema = z.object({
  cost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  laborCost: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});
export type MaintenanceTaskCost = z.infer<typeof MaintenanceTaskCostSchema>;

export const CompleteMaintenanceTaskSchema = z.object({
  completedMileage: z.number().int().positive().optional(),
  cost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  laborCost: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
});
export type CompleteMaintenanceTask = z.infer<typeof CompleteMaintenanceTaskSchema>;

export const AddTaskPhotoSchema = z.object({
  taskId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  fileSizeBytes: z.number().int().positive().optional(),
});
export type AddTaskPhoto = z.infer<typeof AddTaskPhotoSchema>;
