import { MaintenancePriority, MaintenanceTaskSource } from '@motovault/graphql';
import { addDays, format } from 'date-fns';
import { AIR_FILTER, BRAKE_PADS, KM, ODOMETER, TODAY, task } from '../../../test/bike-hub-fixtures';
import {
  DUE_DIMENSION,
  DUE_DIRECTION,
  DUE_DISPLAY,
  DUE_STATE,
  DUE_TONE,
  HUB_UNIT,
} from '../constants';
import { compareTasksForAttention, type DueContext, getTaskDue } from '../task-due';

const iso = (deltaDays: number): string => format(addDays(TODAY, deltaDays), 'yyyy-MM-dd');
const mi = (odometer: number): DueContext => ({ odometer, today: TODAY, unit: HUB_UNIT.MI });

describe('getTaskDue — plan fixtures', () => {
  it('Brake pads: "201 days late · 3,933 km to target", tone late', () => {
    const due = getTaskDue(BRAKE_PADS, KM);
    expect(due.state).toBe(DUE_STATE.OVERDUE);
    expect(due.tone).toBe(DUE_TONE.LATE);
    expect(due.primary).toMatchObject({
      dimension: DUE_DIMENSION.TIME,
      direction: DUE_DIRECTION.PAST,
      amount: 201,
    });
    expect(due.secondary).toMatchObject({
      dimension: DUE_DIMENSION.DISTANCE,
      direction: DUE_DIRECTION.AHEAD,
      amount: 3933,
    });
  });

  it('Air filter: "In 2 days · or in 8,733 km", tone soon', () => {
    const due = getTaskDue(AIR_FILTER, KM);
    expect(due.state).toBe(DUE_STATE.SOON);
    expect(due.tone).toBe(DUE_TONE.SOON);
    expect(due.primary).toMatchObject({
      dimension: DUE_DIMENSION.TIME,
      direction: DUE_DIRECTION.AHEAD,
      amount: 2,
      display: DUE_DISPLAY.RELATIVE,
    });
    expect(due.secondary).toMatchObject({
      dimension: DUE_DIMENSION.DISTANCE,
      direction: DUE_DIRECTION.AHEAD,
      amount: 8733,
    });
  });
});

describe('getTaskDue — component-sheet cases', () => {
  it('Rear brake shoes [mi]: "38 days late · 420 mi past target", both past', () => {
    const due = getTaskDue(
      task({ id: 'a', title: 'Rear brake shoes', dueDate: iso(-38), targetMileage: 10_000 }),
      mi(10_420),
    );
    expect(due.tone).toBe(DUE_TONE.LATE);
    expect(due.primary).toMatchObject({
      dimension: DUE_DIMENSION.TIME,
      direction: DUE_DIRECTION.PAST,
      amount: 38,
    });
    expect(due.secondary).toMatchObject({
      dimension: DUE_DIMENSION.DISTANCE,
      direction: DUE_DIRECTION.PAST,
      amount: 420,
    });
  });

  it('Chain tension [mi]: "12 days late · 180 mi to target"', () => {
    const due = getTaskDue(
      task({ id: 'a', title: 'Chain tension', dueDate: iso(-12), targetMileage: 10_180 }),
      mi(10_000),
    );
    expect(due.state).toBe(DUE_STATE.OVERDUE);
    expect(due.primary).toMatchObject({ direction: DUE_DIRECTION.PAST, amount: 12 });
    expect(due.secondary).toMatchObject({
      dimension: DUE_DIMENSION.DISTANCE,
      direction: DUE_DIRECTION.AHEAD,
      amount: 180,
    });
  });

  it('Engine oil & filter [km]: "In 1,833 km · or by Jan 10", tone soon', () => {
    const due = getTaskDue(
      task({ id: 'a', title: 'Engine oil & filter', dueDate: '2027-01-10', targetMileage: 40_000 }),
      KM,
    );
    expect(due.tone).toBe(DUE_TONE.SOON);
    expect(due.primary).toMatchObject({
      dimension: DUE_DIMENSION.DISTANCE,
      direction: DUE_DIRECTION.AHEAD,
      amount: 1833,
    });
    expect(due.secondary).toMatchObject({
      dimension: DUE_DIMENSION.TIME,
      display: DUE_DISPLAY.DAY,
      date: '2027-01-10',
    });
  });

  it('Brake fluid [km]: "Mar 2027 · Honda schedule", tone plain', () => {
    const due = getTaskDue(
      task({
        id: 'a',
        title: 'Brake fluid',
        dueDate: '2027-03-15',
        source: MaintenanceTaskSource.Oem,
      }),
      KM,
    );
    expect(due.state).toBe(DUE_STATE.LATER);
    expect(due.tone).toBe(DUE_TONE.PLAIN);
    expect(due.primary).toMatchObject({
      dimension: DUE_DIMENSION.TIME,
      display: DUE_DISPLAY.MONTH,
    });
    expect(due.secondary).toBeNull();
    expect(due.fromSchedule).toBe(true);
  });

  it('OEM task [km]: "In 9,833 km · Honda schedule", tone plain', () => {
    const due = getTaskDue(
      task({ id: 'a', title: 'Valves', targetMileage: 48_000, source: MaintenanceTaskSource.Oem }),
      KM,
    );
    expect(due.tone).toBe(DUE_TONE.PLAIN);
    expect(due.primary).toMatchObject({ dimension: DUE_DIMENSION.DISTANCE, amount: 9833 });
    expect(due.fromSchedule).toBe(true);
  });

  it('threshold [mi]: 1,200 ahead is soon, 1,201 is plain', () => {
    const at = (target: number) =>
      getTaskDue(task({ id: 'a', title: 't', targetMileage: target }), mi(5_000)).tone;
    expect(at(6_200)).toBe(DUE_TONE.SOON);
    expect(at(6_201)).toBe(DUE_TONE.PLAIN);
  });

  it('threshold [km]: 2,000 ahead is soon, 2,001 is plain — km values are not converted', () => {
    const at = (target: number) =>
      getTaskDue(task({ id: 'a', title: 't', targetMileage: target }), KM).tone;
    expect(at(ODOMETER + 2_000)).toBe(DUE_TONE.SOON);
    expect(at(ODOMETER + 2_001)).toBe(DUE_TONE.PLAIN);
  });

  it('threshold [km]: 30 days ahead is soon, 31 is plain', () => {
    const at = (days: number) =>
      getTaskDue(task({ id: 'a', title: 't', dueDate: iso(days) }), KM).tone;
    expect(at(30)).toBe(DUE_TONE.SOON);
    expect(at(31)).toBe(DUE_TONE.PLAIN);
  });

  it('undated task without a target is SOMEDAY', () => {
    const due = getTaskDue(task({ id: 'a', title: 't' }), KM);
    expect(due.state).toBe(DUE_STATE.SOMEDAY);
    expect(due.primary).toBeNull();
  });
});

describe('getTaskDue — rules', () => {
  it('is overdue when the odometer has reached the target even though the date is ahead', () => {
    const due = getTaskDue(
      task({ id: 'a', title: 't', dueDate: iso(40), targetMileage: ODOMETER }),
      KM,
    );
    expect(due.state).toBe(DUE_STATE.OVERDUE);
    expect(due.primary).toMatchObject({
      dimension: DUE_DIMENSION.DISTANCE,
      direction: DUE_DIRECTION.PAST,
      amount: 0,
    });
    expect(due.secondary?.dimension).toBe(DUE_DIMENSION.TIME);
  });

  it('a task due today is not overdue', () => {
    const due = getTaskDue(task({ id: 'a', title: 't', dueDate: iso(0) }), KM);
    expect(due.state).toBe(DUE_STATE.SOON);
    expect(due.primary).toMatchObject({ direction: DUE_DIRECTION.AHEAD, amount: 0 });
  });

  it('ties between a date and a distance go to the date', () => {
    const due = getTaskDue(
      task({ id: 'a', title: 't', dueDate: iso(15), targetMileage: ODOMETER + 1_000 }),
      KM,
    );
    expect(due.primary?.dimension).toBe(DUE_DIMENSION.TIME);
  });

  it('shows the bare target when the bike has no odometer and never calls it soon', () => {
    const due = getTaskDue(task({ id: 'a', title: 't', targetMileage: 500 }), {
      ...KM,
      odometer: null,
    });
    expect(due.state).toBe(DUE_STATE.LATER);
    expect(due.primary).toMatchObject({ display: DUE_DISPLAY.ABSOLUTE, amount: 500 });
  });
});

describe('compareTasksForAttention', () => {
  const ranked = (overrides: Parameters<typeof task>[0]) => {
    const t = task(overrides);
    return { task: t, due: getTaskDue(t, KM) };
  };

  it('sorts by priority first, then by the most overdue', () => {
    const lowVeryLate = ranked({
      id: 'low-old',
      title: 'a',
      priority: MaintenancePriority.Low,
      dueDate: iso(-90),
    });
    const lowLate = ranked({
      id: 'low-new',
      title: 'b',
      priority: MaintenancePriority.Low,
      dueDate: iso(-5),
    });
    const critical = ranked({
      id: 'crit',
      title: 'c',
      priority: MaintenancePriority.Critical,
      dueDate: iso(-1),
    });
    const sorted = [lowLate, lowVeryLate, critical].sort((a, b) =>
      compareTasksForAttention(a, b, HUB_UNIT.KM),
    );
    expect(sorted.map((entry) => entry.task.id)).toEqual(['crit', 'low-old', 'low-new']);
  });
});
