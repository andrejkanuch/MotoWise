import { MaintenanceTaskStatus } from '@motovault/graphql';
import {
  getPreFlightBikeStatus,
  PRE_FLIGHT_BIKE_STATUS,
  type PreFlightTask,
} from '../pre-flight-bike-status';

/** Local noon on 2026-10-02; due dates are full timestamps at local noon. */
const NOW = new Date(2026, 9, 2, 12);
const atNoon = (deltaDays: number) => new Date(2026, 9, 2 + deltaDays, 12).toISOString();
const BIKE = 'bike-1';
const pending = (title: string, dueDate: string | null): PreFlightTask => ({
  title,
  dueDate,
  status: MaintenanceTaskStatus.Pending,
});

describe('getPreFlightBikeStatus', () => {
  it('no bike selected', () => {
    expect(getPreFlightBikeStatus(null, [pending('Oil', atNoon(1))], NOW)).toEqual({
      kind: PRE_FLIGHT_BIKE_STATUS.NO_BIKE,
      level: 'na',
    });
  });

  it('no tasks tracked', () => {
    expect(getPreFlightBikeStatus(BIKE, [], NOW)).toEqual({
      kind: PRE_FLIGHT_BIKE_STATUS.NO_TASKS,
      level: 'na',
    });
  });

  it('an overdue task is a warning naming the task', () => {
    expect(
      getPreFlightBikeStatus(
        BIKE,
        [pending('Chain', atNoon(5)), pending('Brakes', atNoon(-2))],
        NOW,
      ),
    ).toEqual({ kind: PRE_FLIGHT_BIKE_STATUS.OVERDUE, level: 'warn', task: 'Brakes' });
  });

  it('a task due in 5 days is a warning with its day count', () => {
    expect(getPreFlightBikeStatus(BIKE, [pending('Chain', atNoon(5))], NOW)).toEqual({
      kind: PRE_FLIGHT_BIKE_STATUS.DUE_IN,
      level: 'warn',
      task: 'Chain',
      days: 5,
    });
  });

  it('a task due in 10 days is ok with its day count', () => {
    expect(getPreFlightBikeStatus(BIKE, [pending('Chain', atNoon(10))], NOW)).toEqual({
      kind: PRE_FLIGHT_BIKE_STATUS.DUE_IN,
      level: 'ok',
      task: 'Chain',
      days: 10,
    });
  });

  it('all clear when every task is completed or undated', () => {
    expect(
      getPreFlightBikeStatus(
        BIKE,
        [
          { ...pending('Done', atNoon(-3)), status: MaintenanceTaskStatus.Completed },
          pending('Someday', null),
        ],
        NOW,
      ),
    ).toEqual({ kind: PRE_FLIGHT_BIKE_STATUS.ALL_CLEAR, level: 'ok' });
  });
});
