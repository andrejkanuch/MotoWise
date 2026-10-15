import { MaintenanceTaskStatus } from '@motovault/graphql';
import { pickWidgetNextService } from '../widget-next-service';

/** Local noon on 2026-10-02; due dates are full timestamps at local noon. */
const NOW = new Date(2026, 9, 2, 12);
const atNoon = (deltaDays: number) => new Date(2026, 9, 2 + deltaDays, 12).toISOString();

interface Task {
  id: string;
  dueDate: string | null;
  status: MaintenanceTaskStatus;
  completedAt: string | null;
}
const pending = (id: string, dueDate: string | null): Task => ({
  id,
  dueDate,
  status: MaintenanceTaskStatus.Pending,
  completedAt: null,
});

describe('pickWidgetNextService', () => {
  it('picks the earliest dated pending task', () => {
    const next = pickWidgetNextService(
      [pending('later', atNoon(9)), pending('undated', null), pending('soon', atNoon(5))],
      NOW,
    );
    expect(next?.task.id).toBe('soon');
  });

  it('skips completed tasks', () => {
    const next = pickWidgetNextService(
      [
        { ...pending('done', atNoon(1)), status: MaintenanceTaskStatus.Completed },
        { ...pending('done-at', atNoon(2)), completedAt: atNoon(0) },
        pending('open', atNoon(5)),
      ],
      NOW,
    );
    expect(next?.task.id).toBe('open');
  });

  it('a task 5 days ahead reads 5, not overdue', () => {
    expect(pickWidgetNextService([pending('a', atNoon(5))], NOW)).toMatchObject({
      daysUntil: 5,
      isOverdue: false,
    });
  });

  it('a task 2 days behind reads overdue by 2', () => {
    expect(pickWidgetNextService([pending('a', atNoon(-2))], NOW)).toMatchObject({
      daysUntil: -2,
      isOverdue: true,
    });
  });

  it('a task with only a mileage target has no day count', () => {
    expect(pickWidgetNextService([pending('a', null)], NOW)).toMatchObject({
      daysUntil: null,
      isOverdue: false,
    });
  });

  it('is null when nothing is pending', () => {
    expect(pickWidgetNextService([], NOW)).toBeNull();
  });
});
