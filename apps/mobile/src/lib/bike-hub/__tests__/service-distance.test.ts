import { MaintenanceTaskStatus } from '@motovault/graphql';
import { distanceSinceLastService } from '../service-distance';

const done = (completedAt: string, completedMileage: number | null) => ({
  status: MaintenanceTaskStatus.Completed,
  completedAt,
  completedMileage,
});

describe('distanceSinceLastService', () => {
  it('is the current odometer minus the latest completed service odometer', () => {
    expect(distanceSinceLastService([done('2026-03-01T10:00:00Z', 12_000)], 13_250)).toEqual({
      distance: 1_250,
      serviceOdometer: 12_000,
    });
  });

  it('uses the latest service by date, not by list order', () => {
    const tasks = [done('2026-05-01T10:00:00Z', 15_000), done('2025-05-01T10:00:00Z', 9_000)];
    expect(distanceSinceLastService(tasks, 16_000)?.distance).toBe(1_000);
  });

  it('is null with no completed service', () => {
    const pending = {
      status: MaintenanceTaskStatus.Pending,
      completedAt: null,
      completedMileage: null,
    };
    expect(distanceSinceLastService([pending], 13_250)).toBeNull();
    expect(distanceSinceLastService([], 13_250)).toBeNull();
  });

  it('skips a completed service that recorded no odometer', () => {
    const tasks = [done('2026-06-01T10:00:00Z', null), done('2026-03-01T10:00:00Z', 12_000)];
    expect(distanceSinceLastService(tasks, 13_250)?.serviceOdometer).toBe(12_000);
  });

  it('is null when the bike has no odometer', () => {
    expect(distanceSinceLastService([done('2026-03-01T10:00:00Z', 12_000)], null)).toBeNull();
  });
});
