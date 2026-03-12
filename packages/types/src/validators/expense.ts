import { z } from 'zod';

export const LogExpenseSchema = z.object({
  motorcycleId: z.string().uuid(),
  amount: z.number().positive().max(99999.99),
  category: z.enum(['fuel', 'maintenance', 'parts', 'gear']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  description: z.string().max(200).optional(),
});
export type LogExpense = z.infer<typeof LogExpenseSchema>;

export const UpdateExpenseSchema = z.object({
  amount: z.number().positive().max(99999.99).optional(),
  category: z.enum(['fuel', 'maintenance', 'parts', 'gear']).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  description: z.string().max(200).nullable().optional(),
});
export type UpdateExpense = z.infer<typeof UpdateExpenseSchema>;
