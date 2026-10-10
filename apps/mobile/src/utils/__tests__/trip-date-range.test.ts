import { formatTripDateRangeLong, formatTripDateRangeShort } from '../trip-date-range';

const JUNE_14 = '2026-06-14T12:00:00.000Z';
const JULY_2 = '2026-07-02T12:00:00.000Z';
const EN_DASH = '–';

describe('formatTripDateRangeLong', () => {
  it('formats both dates in English with the year, whatever the device locale', () => {
    const toLocaleDateString = jest.spyOn(Date.prototype, 'toLocaleDateString');

    expect(formatTripDateRangeLong(JUNE_14, JULY_2)).toBe(`June 14, 2026 ${EN_DASH} July 2, 2026`);
    expect(toLocaleDateString.mock.calls.map(([locale]) => locale)).toEqual(['en-US', 'en-US']);

    toLocaleDateString.mockRestore();
  });
});

describe('formatTripDateRangeShort', () => {
  it('gives a single date when start and end are equal', () => {
    const single = formatTripDateRangeShort(JUNE_14, JUNE_14);

    expect(single).toContain('14');
    expect(single).not.toContain(EN_DASH);
  });

  it('joins two different dates with an en dash', () => {
    const [from, to, ...rest] = formatTripDateRangeShort(JUNE_14, JULY_2).split(` ${EN_DASH} `);

    expect(rest).toEqual([]);
    expect(from).toBe(formatTripDateRangeShort(JUNE_14, JUNE_14));
    expect(to).toBe(formatTripDateRangeShort(JULY_2, JULY_2));
  });
});
