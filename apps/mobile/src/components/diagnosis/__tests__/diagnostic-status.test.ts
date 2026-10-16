import { formatQuotaResetDate } from '../diagnostic-status';

describe('formatQuotaResetDate', () => {
  // The reset is 00:00 UTC on the 1st. Formatted in local time, every rider
  // west of UTC (the whole Americas) would read the last day of the month.
  const RESET = '2026-11-01T00:00:00.000Z';

  it('shows the 1st of the month, not the local-time previous day', () => {
    expect(formatQuotaResetDate(RESET, 'en-US')).toBe('November 1');
  });

  it('follows the app language', () => {
    expect(formatQuotaResetDate(RESET, 'de')).toBe('1. November');
  });
});
