import { describe, expect, it } from 'vitest';
import { formatExpenseTotals } from './format-expense-totals';

describe('formatExpenseTotals', () => {
  it('formats a single currency as one plain total', () => {
    expect(formatExpenseTotals([{ currency: 'USD', total: 165.5 }])).toBe('$165.50');
  });

  it('joins mixed currencies instead of summing them', () => {
    expect(
      formatExpenseTotals([
        { currency: 'EUR', total: 320 },
        { currency: 'USD', total: 45 },
      ]),
    ).toBe('€320.00 · $45.00');
  });

  it('returns an empty string for no totals', () => {
    expect(formatExpenseTotals([])).toBe('');
  });
});
