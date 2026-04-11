import { z } from 'zod';
import { Currency } from '../constants/enums';

const currencyValues = Object.values(Currency) as [string, ...string[]];

export const EXPENSE_CATEGORIES = [
  'fuel',
  'maintenance',
  'parts',
  'gear',
  'tires',
  'insurance',
  'registration',
  'tolls',
  'parking',
  'modifications',
  'training',
] as const;

export const LogExpenseSchema = z.object({
  motorcycleId: z.string().uuid(),
  amount: z.number().positive().max(99999.99),
  category: z.enum(EXPENSE_CATEGORIES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  description: z.string().max(200).optional(),
  currency: z.enum(currencyValues).optional(),
});
export type LogExpense = z.infer<typeof LogExpenseSchema>;

export const UpdateExpenseSchema = z.object({
  amount: z.number().positive().max(99999.99).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')
    .optional(),
  description: z.string().max(200).nullable().optional(),
});
export type UpdateExpense = z.infer<typeof UpdateExpenseSchema>;

// MOT-143: Receipt photo attachments on expenses
export const AddExpensePhotoSchema = z.object({
  expenseId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  fileSizeBytes: z.number().int().positive().optional(),
});
export type AddExpensePhoto = z.infer<typeof AddExpensePhotoSchema>;
