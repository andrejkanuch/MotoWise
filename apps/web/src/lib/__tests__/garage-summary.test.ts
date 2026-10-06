import { describe, expect, it } from 'vitest';
import { pickNextService, sumTotalsPerCurrency, webVisibleBikes } from '../garage-summary';

describe('sumTotalsPerCurrency', () => {
  it('adds the same currency across bikes', () => {
    expect(
      sumTotalsPerCurrency([
        [{ currency: 'EUR', total: 120, count: 2 }],
        [{ currency: 'EUR', total: 80, count: 1 }],
      ]),
    ).toEqual([{ currency: 'EUR', total: 200 }]);
  });

  it('never adds two currencies together (€50 + $40 is two totals, not 90)', () => {
    expect(
      sumTotalsPerCurrency([
        [{ currency: 'EUR', total: 50, count: 2 }],
        [{ currency: 'USD', total: 40, count: 1 }],
      ]),
    ).toEqual([
      { currency: 'EUR', total: 50 },
      { currency: 'USD', total: 40 },
    ]);
  });

  it('puts the most-used currency first, then drops zero totals', () => {
    expect(
      sumTotalsPerCurrency([
        [
          { currency: 'USD', total: 900, count: 1 },
          { currency: 'EUR', total: 30, count: 3 },
          { currency: 'GBP', total: 0, count: 0 },
        ],
      ]),
    ).toEqual([
      { currency: 'EUR', total: 30 },
      { currency: 'USD', total: 900 },
    ]);
  });

  it('returns no totals when nothing was spent', () => {
    expect(sumTotalsPerCurrency([[], []])).toEqual([]);
  });
});

describe('pickNextService', () => {
  const task = (id: string, dueDate: string | null, priority = 'medium', status = 'pending') => ({
    id,
    dueDate,
    priority,
    status,
  });

  it('picks the earliest due date, so an overdue task comes first', () => {
    const next = pickNextService([
      task('later', '2099-06-01'),
      task('overdue', '2000-01-01'),
      task('soon', '2099-01-01'),
    ]);
    expect(next?.id).toBe('overdue');
  });

  it('breaks a tie on the due date by priority', () => {
    const next = pickNextService([
      task('low', '2099-01-01', 'low'),
      task('critical', '2099-01-01', 'critical'),
    ]);
    expect(next?.id).toBe('critical');
  });

  it('ignores tasks with no due date and tasks that are not active', () => {
    expect(
      pickNextService([task('undated', null), task('done', '2000-01-01', 'high', 'completed')]),
    ).toBeUndefined();
  });
});

describe('webVisibleBikes', () => {
  it('shows every bike with Pro and the first bike without it', () => {
    expect(webVisibleBikes(['a', 'b', 'c'], true)).toEqual(['a', 'b', 'c']);
    expect(webVisibleBikes(['a', 'b', 'c'], false)).toEqual(['a']);
    expect(webVisibleBikes([], false)).toEqual([]);
  });
});
