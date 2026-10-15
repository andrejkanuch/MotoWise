import { MaintenancePriority } from '@motovault/graphql';
import { type BadgeTask, countGarageBadge } from '../garage-badge-count';

/** Local noon on 2026-10-02; due dates are full timestamps at local noon. */
const NOW = new Date(2026, 9, 2, 12);
const atNoon = (deltaDays: number) => new Date(2026, 9, 2 + deltaDays, 12).toISOString();
const task = (priority: MaintenancePriority, dueDate: string | null): BadgeTask => ({
  priority,
  dueDate,
});

describe('garageBadgeCount', () => {
  it('counts an overdue task whatever its priority', () => {
    expect(countGarageBadge([task(MaintenancePriority.Low, atNoon(-1))], NOW)).toBe(1);
  });

  it('counts a critical task due in 3 days', () => {
    expect(countGarageBadge([task(MaintenancePriority.Critical, atNoon(3))], NOW)).toBe(1);
  });

  it('does not count a medium task due in 3 days', () => {
    expect(countGarageBadge([task(MaintenancePriority.Medium, atNoon(3))], NOW)).toBe(0);
  });

  it('does not count a task with no date', () => {
    expect(countGarageBadge([task(MaintenancePriority.Critical, null)], NOW)).toBe(0);
  });

  it('adds up across tasks', () => {
    expect(
      countGarageBadge(
        [
          task(MaintenancePriority.Low, atNoon(-1)),
          task(MaintenancePriority.High, atNoon(2)),
          task(MaintenancePriority.Medium, atNoon(2)),
          task(MaintenancePriority.Critical, null),
        ],
        NOW,
      ),
    ).toBe(2);
  });
});
