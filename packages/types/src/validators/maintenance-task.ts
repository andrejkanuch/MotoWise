import { z } from 'zod';

export const CreateMaintenanceTaskSchema = z.object({
  motorcycleId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.string().optional(),
  targetMileage: z.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  notes: z.string().max(2000).optional(),
  partsNeeded: z.array(z.string().max(100)).max(20).optional(),
});
export type CreateMaintenanceTask = z.infer<typeof CreateMaintenanceTaskSchema>;

export const UpdateMaintenanceTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  dueDate: z.string().optional(),
  targetMileage: z.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  notes: z.string().max(2000).optional(),
  partsNeeded: z.array(z.string().max(100)).max(20).optional(),
});
export type UpdateMaintenanceTask = z.infer<typeof UpdateMaintenanceTaskSchema>;

export const CompleteMaintenanceTaskSchema = z.object({
  completedMileage: z.number().int().positive().optional(),
});
export type CompleteMaintenanceTask = z.infer<typeof CompleteMaintenanceTaskSchema>;
