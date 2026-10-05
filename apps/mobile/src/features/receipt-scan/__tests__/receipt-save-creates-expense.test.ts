import { receiptSaveCreatesExpense } from '../receipt-save-expense';

// A receipt saved as an expense always creates one; a service record creates a
// linked expense only when it carries a positive amount.
describe('receiptSaveCreatesExpense', () => {
  it.each([
    ['expense', null, true],
    ['expense', 0, true],
    ['maintenance', 50, true],
    ['maintenance', 0, false],
    ['maintenance', null, false],
  ] as const)('%s with amount %p -> %p', (recordType, amount, expected) => {
    expect(receiptSaveCreatesExpense(recordType, amount)).toBe(expected);
  });
});
