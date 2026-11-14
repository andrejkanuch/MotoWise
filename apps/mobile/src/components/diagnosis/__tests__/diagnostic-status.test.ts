import { formatQuotaResetDate, formatQuotaResetDay } from '../diagnostic-status';

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

describe('formatQuotaResetDay (issue 365 T08 limit panel)', () => {
  const RESET = '2026-12-01T00:00:00.000Z';

  it.each([
    ['en', 'December 1st, 2026'],
    ['en-US', 'December 1st, 2026'],
    ['de', '1. Dezember 2026'],
    ['es-ES', '1 de diciembre de 2026'],
    ['pt-BR', '1 de dezembro de 2026'],
    ['xx', 'December 1st, 2026'],
  ])('formats the reset day with date-fns PPP in %s', (language, expected) => {
    expect(formatQuotaResetDay(RESET, language)).toBe(expected);
  });

  it('is null for a value that is not a date, never "Invalid date"', () => {
    expect(formatQuotaResetDay('not-a-date', 'en')).toBeNull();
  });
});
