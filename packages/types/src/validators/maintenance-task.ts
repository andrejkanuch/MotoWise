import { z } from 'zod';
import { Currency } from '../constants/enums';
import { nullishToUndefined } from './nullish';

const currencyValues = Object.values(Currency) as [string, ...string[]];

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
  // MOT-139 multi-stage reminder flags. Defaults on the DB side preserve
  // legacy behaviour (only 1d is enabled by default).
  remind30d: z.boolean().optional(),
  remind7d: z.boolean().optional(),
  remind1d: z.boolean().optional(),
  // Create-as-completed: lets the client log work already done (a historical
  // record) in one call. When status is 'completed', completedAt anchors the
  // record to the day the work happened and completedMileage is the odometer
  // reading at that time (stored raw, in the user's display unit).
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
  completedAt: z.string().datetime().optional(),
  completedMileage: z.number().int().positive().optional(),
});
export type CreateMaintenanceTask = z.infer<typeof CreateMaintenanceTaskSchema>;

export const UpdateMaintenanceTaskSchema = z.object({
  title: nullishToUndefined(z.string().min(1).max(200)),
  description: z.string().max(1000).nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .nullable()
    .optional(),
  targetMileage: z.number().int().positive().nullable().optional(),
  priority: nullishToUndefined(z.enum(['low', 'medium', 'high', 'critical'])),
  notes: z.string().max(2000).nullable().optional(),
  partsNeeded: z.array(z.string().max(100)).max(20).nullable().optional(),
  // MOT-139 multi-stage reminder flags
  remind30d: nullishToUndefined(z.boolean()),
  remind7d: nullishToUndefined(z.boolean()),
  remind1d: nullishToUndefined(z.boolean()),
});
export type UpdateMaintenanceTask = z.infer<typeof UpdateMaintenanceTaskSchema>;

export const MaintenanceTaskCostSchema = z.object({
  cost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  laborCost: z.number().min(0).optional(),
  currency: z.enum(currencyValues).optional(),
});
export type MaintenanceTaskCost = z.infer<typeof MaintenanceTaskCostSchema>;

export const CompleteMaintenanceTaskSchema = z.object({
  completedMileage: z.number().int().positive().optional(),
  cost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  laborCost: z.number().min(0).optional(),
  currency: z.enum(currencyValues).optional(),
});
export type CompleteMaintenanceTask = z.infer<typeof CompleteMaintenanceTaskSchema>;

export const AddTaskPhotoSchema = z.object({
  taskId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  fileSizeBytes: z.number().int().positive().optional(),
});
export type AddTaskPhoto = z.infer<typeof AddTaskPhotoSchema>;
