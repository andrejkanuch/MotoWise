import { describe, expect, it } from '@jest/globals';
import { computeReadiness, formatReadinessBrief } from '../readiness';

const bike = { id: 'b1', tankLiters: 15, kmPerLiter: 18 };
const futureDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};

describe('computeReadiness', () => {
  it('fails if route has <2 stops', () => {
    const r = computeReadiness(
      { waypoints: [{ lat: 0, lng: 0, sortOrder: 0 }] },
      bike,
    );
    expect(r.items.find((i) => i.key === 'route')?.passed).toBe(false);
  });

  it('flags when longest leg exceeds fuel range', () => {
    // 800km leg on a bike with ~216km range -> fails
    const r = computeReadiness(
      {
        startDate: futureDate(),
        endDate: futureDate(),
        waypoints: [
          { lat: 40, lng: -74, sortOrder: 0 },
          { lat: 47, lng: -74, sortOrder: 1 },
        ],
      },
      bike,
    );
    expect(r.items.find((i) => i.key === 'fuel')?.passed).toBe(false);
  });

  it('passes fuel check for a short leg', () => {
    const r = computeReadiness(
      {
        startDate: futureDate(),
        endDate: futureDate(),
        waypoints: [
          { lat: 40, lng: -74, sortOrder: 0, name: 'Start' },
          { lat: 40.1, lng: -74.1, sortOrder: 1, name: 'Finish' },
        ],
      },
      bike,
    );
    expect(r.items.find((i) => i.key === 'fuel')?.passed).toBe(true);
  });

  it('weights required items double', () => {
    const r = computeReadiness(
      {
        startDate: futureDate(),
        endDate: futureDate(),
        waypoints: [
          { lat: 40, lng: -74, sortOrder: 0, name: 'Start' },
          { lat: 40.1, lng: -74.1, sortOrder: 1, name: 'Finish' },
        ],
        visibility: 'public',
        participantCount: 1,
      },
      bike,
    );
    // All required pass, all recommended pass -> score 1
    expect(r.score).toBeGreaterThan(0.9);
  });

  it('flags a start date in the past', () => {
    const r = computeReadiness(
      {
        startDate: '2020-01-01',
        endDate: '2020-01-02',
        waypoints: [
          { lat: 0, lng: 0, sortOrder: 0, name: 'a' },
          { lat: 0.1, lng: 0.1, sortOrder: 1, name: 'b' },
        ],
      },
      bike,
    );
    expect(r.items.find((i) => i.key === 'dates')?.passed).toBe(false);
  });
});

describe('formatReadinessBrief', () => {
  it('renders a shareable ascii brief', () => {
    const readiness = computeReadiness(
      {
        startDate: futureDate(),
        endDate: futureDate(),
        waypoints: [
          { lat: 0, lng: 0, sortOrder: 0, name: 'Start' },
          { lat: 0.1, lng: 0.1, sortOrder: 1, name: 'Finish' },
        ],
      },
      bike,
    );
    const brief = formatReadinessBrief({
      tripTitle: 'Alpine Loop',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      waypoints: [
        { name: 'Start', notes: null },
        { name: 'Finish', notes: 'Hotel Alpin' },
      ],
      readiness,
    });
    expect(brief).toContain('🏍 Alpine Loop');
    expect(brief).toContain('Ready to ride:');
    expect(brief).toContain('Finish — Hotel Alpin');
  });
});
