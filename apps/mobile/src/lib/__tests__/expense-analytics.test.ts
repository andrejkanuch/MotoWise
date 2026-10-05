const mockTrackEvent = jest.fn();
jest.mock('../analytics', () => ({
  AnalyticsEvent: { EXPENSE_ADDED: 'expense_added' },
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import {
  EXPENSE_ENTRY_SOURCE,
  expenseAddedProperties,
  isBackdated,
  parseExpenseEntrySource,
  trackExpenseAdded,
} from '../expense-analytics';

// Local noon, so the calendar day is the same in every test timezone.
const NOW = new Date(2026, 9, 5, 12, 0, 0);

describe('isBackdated', () => {
  it('is false for today, whatever the time', () => {
    expect(isBackdated(new Date(2026, 9, 5, 0, 1), NOW)).toBe(false);
    expect(isBackdated('2026-10-05', NOW)).toBe(false);
  });

  it('is true for any earlier calendar day', () => {
    expect(isBackdated(new Date(2026, 9, 4, 23, 59), NOW)).toBe(true);
    expect(isBackdated('2026-09-30', NOW)).toBe(true);
  });

  it('is false when the date is unknown or unparseable', () => {
    expect(isBackdated(null, NOW)).toBe(false);
    expect(isBackdated(undefined, NOW)).toBe(false);
    expect(isBackdated('not a date', NOW)).toBe(false);
  });
});

describe('parseExpenseEntrySource', () => {
  it('accepts a known source', () => {
    expect(parseExpenseEntrySource('receipt_scan_fallback', EXPENSE_ENTRY_SOURCE.MANUAL)).toBe(
      EXPENSE_ENTRY_SOURCE.RECEIPT_SCAN_FALLBACK,
    );
  });

  it('falls back for anything else', () => {
    expect(parseExpenseEntrySource('spoofed', EXPENSE_ENTRY_SOURCE.MANUAL)).toBe('manual');
    expect(parseExpenseEntrySource(undefined, EXPENSE_ENTRY_SOURCE.MANUAL)).toBe('manual');
  });
});

describe('expenseAddedProperties', () => {
  it('stamps entry_source, bike_id and is_backdated over the path extras', () => {
    expect(
      expenseAddedProperties({
        entrySource: EXPENSE_ENTRY_SOURCE.RIDE,
        bikeId: 'bike-1',
        date: '2026-10-01',
        properties: { category: 'fuel', amount: 12 },
        now: NOW,
      }),
    ).toEqual({
      category: 'fuel',
      amount: 12,
      entry_source: 'ride',
      bike_id: 'bike-1',
      is_backdated: true,
    });
  });

  it('sends a missing bike as null, not an empty string', () => {
    expect(
      expenseAddedProperties({
        entrySource: EXPENSE_ENTRY_SOURCE.MANUAL,
        bikeId: '',
        date: NOW,
        now: NOW,
      }).bike_id,
    ).toBeNull();
  });
});

describe('trackExpenseAdded', () => {
  it('fires expense_added', () => {
    trackExpenseAdded({
      entrySource: EXPENSE_ENTRY_SOURCE.RECEIPT_SCAN,
      bikeId: 'b',
      date: NOW,
      now: NOW,
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('expense_added', {
      entry_source: 'receipt_scan',
      bike_id: 'b',
      is_backdated: false,
    });
  });
});
