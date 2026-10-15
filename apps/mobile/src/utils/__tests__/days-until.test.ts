import { describe, expect, it } from '@jest/globals';
import { daysUntil } from '../days-until';

/** The rider's day, 2026-10-02, at two moments where UTC and local dates differ most. */
const MOMENTS_OF_OCT_2: Array<[label: string, today: Date]> = [
  ['00:30', new Date(2026, 9, 2, 0, 30)],
  ['23:30', new Date(2026, 9, 2, 23, 30)],
];

describe('daysUntil', () => {
  describe.each(MOMENTS_OF_OCT_2)('today is 2026-10-02 at %s', (_label, today) => {
    it('a date-only string of today is 0', () => {
      expect(daysUntil('2026-10-02', today)).toBe(0);
    });

    it('a date-only string of tomorrow is 1', () => {
      expect(daysUntil('2026-10-03', today)).toBe(1);
    });

    it('a date-only string of yesterday is −1', () => {
      expect(daysUntil('2026-10-01', today)).toBe(-1);
    });

    it('a full ISO timestamp at local noon three days ahead is 3', () => {
      expect(daysUntil(new Date(2026, 9, 5, 12).toISOString(), today)).toBe(3);
    });
  });

  it('an unparseable string is NaN', () => {
    expect(daysUntil('not a date', new Date(2026, 9, 2, 12))).toBeNaN();
  });

  it('defaults today to now', () => {
    const now = new Date();
    const todayDateOnly = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    expect(daysUntil(todayDateOnly)).toBe(0);
  });
});
