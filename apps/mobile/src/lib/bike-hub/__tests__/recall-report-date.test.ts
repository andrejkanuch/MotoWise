import { describe, expect, it } from '@jest/globals';
import { formatRecallReportDate } from '../format';

describe('formatRecallReportDate', () => {
  it("formats NHTSA's DD/MM/YYYY for the locale", () => {
    expect(formatRecallReportDate('18/10/2022', 'en-US')).toBe('Oct 18, 2022');
  });

  it('formats an ISO date too', () => {
    expect(formatRecallReportDate('2020-12-15', 'en-US')).toBe('Dec 15, 2020');
  });

  it('shows anything unparseable as received', () => {
    expect(formatRecallReportDate('', 'en-US')).toBe('');
    expect(formatRecallReportDate('unknown', 'en-US')).toBe('unknown');
  });
});
