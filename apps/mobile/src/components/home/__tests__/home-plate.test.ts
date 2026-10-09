jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

import { MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import type { TFunction } from 'i18next';
import { PLATE_STATE } from '../../ui/bike-plate';
import { describePlate, rankBikeTasks } from '../home-plate';
import type { TaskItem } from '../home-types';

const TODAY = new Date(2026, 9, 9);
const BIKE = 'bike-1';
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: 'task',
    motorcycleId: BIKE,
    title: 'Oil change',
    dueDate: null,
    targetMileage: null,
    priority: MaintenancePriority.Medium,
    status: MaintenanceTaskStatus.Pending,
    completedAt: null,
    remind30d: false,
    remind7d: false,
    remind1d: false,
    ...overrides,
  };
}

const context = { bikeId: BIKE, odometer: 10_000, unit: 'mi' as const, today: TODAY };
const copy = { t, language: 'en-US', unit: 'mi' as const, odometer: 10_000 };

describe('home plate', () => {
  it('is ready and shows the raw odometer when nothing is due', () => {
    const plate = describePlate(rankBikeTasks([], context)[0], copy);
    expect(plate.state).toBe(PLATE_STATE.READY);
    expect(plate.figure).toBe('10,000');
    expect(plate.unit).toBe('mi');
    expect(plate.caption).toBe('home.noServiceDue');
  });

  it('counts down in the rider unit without converting', () => {
    const ranked = rankBikeTasks([task({ targetMileage: 10_500 })], context);
    const plate = describePlate(ranked[0], copy);
    expect(plate.state).toBe(PLATE_STATE.DUE);
    expect(plate.figure).toBe('500');
    expect(plate.unit).toBe('mi');
  });

  it('leads with the overdue task and ignores other bikes and done tasks', () => {
    const ranked = rankBikeTasks(
      [
        task({ id: 'later', dueDate: '2026-12-30' }),
        task({ id: 'late', dueDate: '2026-10-01', title: 'Chain' }),
        task({ id: 'other', motorcycleId: 'bike-2', dueDate: '2026-09-01' }),
        task({ id: 'done', dueDate: '2026-08-01', status: MaintenanceTaskStatus.Completed }),
      ],
      context,
    );
    expect(ranked.map((r) => r.task.id)).toEqual(['late', 'later']);
    const plate = describePlate(ranked[0], copy);
    expect(plate.state).toBe(PLATE_STATE.OVERDUE);
    expect(plate.figure).toBe('8');
    expect(plate.caption).toContain('home.plateCaptionLate');
  });
});
