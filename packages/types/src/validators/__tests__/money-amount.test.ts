import { describe, expect, it } from 'vitest';
import { MONEY_AMOUNT_MAX } from '../../constants/limits';
import { LogExpenseSchema, UpdateExpenseSchema } from '../expense';
import { UpdateMotorcycleSchema } from '../motorcycle';

const expenseBase = {
  motorcycleId: '6fb4b88f-c0eb-4bb2-b767-9f45b00c53f2',
  category: 'maintenance',
  date: '2026-11-03',
};

describe('money amounts in high-denomination currencies', () => {
  it('accepts a Colombian service bill above the old 99,999.99 cap', () => {
    const result = LogExpenseSchema.safeParse({ ...expenseBase, amount: 480_000, currency: 'COP' });
    expect(result.success).toBe(true);
  });

  it('accepts the cap itself and rejects anything above it', () => {
    expect(LogExpenseSchema.safeParse({ ...expenseBase, amount: MONEY_AMOUNT_MAX }).success).toBe(
      true,
    );
    expect(
      LogExpenseSchema.safeParse({ ...expenseBase, amount: MONEY_AMOUNT_MAX + 0.01 }).success,
    ).toBe(false);
    expect(UpdateExpenseSchema.safeParse({ amount: MONEY_AMOUNT_MAX + 1 }).success).toBe(false);
  });

  it('accepts a PHP expense', () => {
    const result = LogExpenseSchema.safeParse({ ...expenseBase, amount: 3_250, currency: 'PHP' });
    expect(result.success).toBe(true);
  });

  it('accepts a bike purchase price in COP above the old 999,999.99 cap', () => {
    expect(UpdateMotorcycleSchema.safeParse({ purchasePrice: 14_000_000 }).success).toBe(true);
    expect(UpdateMotorcycleSchema.safeParse({ purchasePrice: MONEY_AMOUNT_MAX + 1 }).success).toBe(
      false,
    );
  });
});
