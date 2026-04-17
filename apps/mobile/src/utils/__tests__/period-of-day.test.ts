import { describe, expect, it } from '@jest/globals';
import { groupByPeriod } from '../period-of-day';

describe('groupByPeriod', () => {
  it('keeps legacy unlabelled stops in a single top bucket', () => {
    const groups = groupByPeriod([
      { id: 'a', sortOrder: 1, periodOfDay: null },
      { id: 'b', sortOrder: 0, periodOfDay: undefined },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].period).toBeNull();
    expect(groups[0].items.map((w) => w.id)).toEqual(['b', 'a']);
  });

  it('orders buckets morning → afternoon → evening', () => {
    const groups = groupByPeriod([
      { id: 'e', sortOrder: 3, periodOfDay: 'evening' as const },
      { id: 'a', sortOrder: 1, periodOfDay: 'afternoon' as const },
      { id: 'm', sortOrder: 0, periodOfDay: 'morning' as const },
    ]);
    expect(groups.map((g) => g.period)).toEqual(['morning', 'afternoon', 'evening']);
  });

  it('sorts inside each bucket by sortOrder', () => {
    const groups = groupByPeriod([
      { id: 'a2', sortOrder: 5, periodOfDay: 'afternoon' as const },
      { id: 'a1', sortOrder: 2, periodOfDay: 'afternoon' as const },
    ]);
    expect(groups[0].items.map((w) => w.id)).toEqual(['a1', 'a2']);
  });

  it('mixes legacy and period-tagged stops in a sensible order', () => {
    const groups = groupByPeriod([
      { id: 'legacy', sortOrder: 0, periodOfDay: null },
      { id: 'morning', sortOrder: 1, periodOfDay: 'morning' as const },
    ]);
    expect(groups.map((g) => g.period)).toEqual([null, 'morning']);
  });
});
