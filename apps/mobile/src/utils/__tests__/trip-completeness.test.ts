import { computeTripCompleteness } from '../trip-completeness';

describe('computeTripCompleteness', () => {
  it('returns zero when the trip is an empty draft', () => {
    const c = computeTripCompleteness({
      description: '',
      waypointCount: 0,
      dayCount: 3,
      participantCount: 0,
      maxRiders: 5,
    });
    expect(c.percent).toBe(0);
    expect(c.filled).toBe(0);
    expect(c.missing).toHaveLength(4);
  });

  it('scores a fully planned trip at 100', () => {
    const c = computeTripCompleteness({
      description: 'Three-day alps loop with twisties and coffee stops.',
      waypointCount: 6,
      dayCount: 3,
      participantCount: 2,
      maxRiders: 4,
    });
    expect(c.percent).toBe(100);
    expect(c.missing).toEqual([]);
  });

  it('partial credit when stops are below day count', () => {
    const c = computeTripCompleteness({
      description: 'Short but valid description of the trip.',
      waypointCount: 1,
      dayCount: 5,
      participantCount: 1,
      maxRiders: 2,
    });
    expect(c.filled).toBe(3); // description + any stops + participants
    expect(c.missing).toContain('Add more stops so each day has one');
  });

  it('ignores participant gap on solo trips', () => {
    const c = computeTripCompleteness({
      description: 'Solo trip, quiet ride, nothing fancy planned here.',
      waypointCount: 2,
      dayCount: 1,
      participantCount: 0,
      maxRiders: 1,
    });
    expect(c.percent).toBe(100);
  });
});
