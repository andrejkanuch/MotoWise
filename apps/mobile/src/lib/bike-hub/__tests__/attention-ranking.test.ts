import { MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import { addDays, format } from 'date-fns';
import {
  AIR_FILTER,
  BIKE_A_DOCUMENTS,
  BIKE_A_TASKS,
  BRAKE_PADS,
  CATEGORIES,
  document,
  ECU_RECALL,
  KM,
  ODOMETER,
  TODAY,
  task,
} from '../../../test/bike-hub-fixtures';
import { type AttentionInput, getNextUp, getServiceBadgeCount, rankAttention } from '../attention';
import { ATTENTION_KIND, ATTENTION_MAX_ROWS, HUB_UNIT } from '../constants';
import type { DueContext } from '../task-due';

const iso = (deltaDays: number): string => format(addDays(TODAY, deltaDays), 'yyyy-MM-dd');
const MI: DueContext = { odometer: 10_000, today: TODAY, unit: HUB_UNIT.MI };

function rank(overrides: Partial<AttentionInput>) {
  return rankAttention({
    tasks: [],
    documents: [],
    categories: CATEGORIES,
    recalls: [],
    ...KM,
    ...overrides,
  });
}

const late = (id: string, priority: MaintenancePriority, daysLate: number) =>
  task({ id, title: id, priority, dueDate: iso(-daysLate) });
const soon = (id: string, priority: MaintenancePriority, daysAhead: number) =>
  task({ id, title: id, priority, dueDate: iso(daysAhead) });

describe('rankAttention — the five classes, in order', () => {
  // Deliberately shuffled: the result must not depend on the input order.
  const tasks = [
    soon('soon-critical', MaintenancePriority.Critical, 3),
    late('late-low', MaintenancePriority.Low, 400),
    late('late-high', MaintenancePriority.High, 2),
    soon('soon-low', MaintenancePriority.Low, 1),
    late('late-medium', MaintenancePriority.Medium, 1),
    late('late-critical', MaintenancePriority.Critical, 1),
  ];
  const documents = [
    document({ id: 'doc-expiring', categoryId: 'cat-insurance', expiryDate: iso(12) }),
    document({ id: 'doc-expired', categoryId: 'cat-warranty', expiryDate: iso(-3) }),
  ];
  const result = rank({ tasks, documents, recalls: [ECU_RECALL] });

  it('recalls → overdue Critical/High → documents → other overdue → due soon', () => {
    expect(result.items.map((item) => item.id)).toEqual([
      'recalls',
      'late-critical',
      'late-high',
      'doc-expired',
      'doc-expiring',
      'late-medium',
      'late-low',
      'soon-critical',
      'soon-low',
    ]);
  });

  it('an overdue Low task outranks a Critical task that is only due soon', () => {
    const ids = result.items.map((item) => item.id);
    expect(ids.indexOf('late-low')).toBeLessThan(ids.indexOf('soon-critical'));
  });

  it('an expiring document outranks a Medium task 1 day late, but not a High one', () => {
    const ids = result.items.map((item) => item.id);
    expect(ids.indexOf('late-high')).toBeLessThan(ids.indexOf('doc-expiring'));
    expect(ids.indexOf('doc-expiring')).toBeLessThan(ids.indexOf('late-medium'));
  });

  it('gives the same ranking for the same tasks in another order', () => {
    const reversed = rank({ tasks: [...tasks].reverse(), documents, recalls: [ECU_RECALL] });
    expect(reversed.items.map((item) => item.id)).toEqual(result.items.map((item) => item.id));
  });
});

describe('rankAttention — order inside a class', () => {
  it('Critical before High whatever the lateness, then the most overdue first', () => {
    const result = rank({
      tasks: [
        late('high-old', MaintenancePriority.High, 300),
        late('critical-new', MaintenancePriority.Critical, 1),
        late('high-new', MaintenancePriority.High, 5),
        late('critical-old', MaintenancePriority.Critical, 60),
      ],
    });
    expect(result.items.map((item) => item.id)).toEqual([
      'critical-old',
      'critical-new',
      'high-old',
      'high-new',
    ]);
  });

  it('due-soon tasks: priority first, then the nearest', () => {
    const result = rank({
      tasks: [
        soon('medium-1d', MaintenancePriority.Medium, 1),
        soon('high-20d', MaintenancePriority.High, 20),
        soon('high-4d', MaintenancePriority.High, 4),
      ],
    });
    expect(result.items.map((item) => item.id)).toEqual(['high-4d', 'high-20d', 'medium-1d']);
  });

  it('a task overdue by distance ranks with the overdue ones', () => {
    const result = rank({
      tasks: [
        soon('soon', MaintenancePriority.High, 2),
        task({
          id: 'past-target',
          title: 'Chain',
          priority: MaintenancePriority.Low,
          targetMileage: ODOMETER - 1,
        }),
      ],
    });
    expect(result.items.map((item) => item.id)).toEqual(['past-target', 'soon']);
  });
});

describe('rankAttention — what never shows', () => {
  it.each([
    ['a task due in 31 days', task({ id: 'x', title: 'x', dueDate: iso(31) })],
    [
      'a task 2,001 km from its target',
      task({ id: 'x', title: 'x', targetMileage: ODOMETER + 2_001 }),
    ],
    ['an undated task without a target', task({ id: 'x', title: 'x' })],
    [
      'a completed task with a past date',
      { ...late('x', MaintenancePriority.Critical, 30), status: MaintenanceTaskStatus.Completed },
    ],
    [
      'a skipped task with a past date',
      { ...late('x', MaintenancePriority.High, 30), status: MaintenanceTaskStatus.Skipped },
    ],
  ])('%s is not an attention row', (_label, hidden) => {
    expect(rank({ tasks: [hidden] }).total).toBe(0);
  });

  it.each([
    ['without an expiry date', null],
    ['expiring in 31 days', iso(31)],
  ])('a document %s is not an attention row', (_label, expiryDate) => {
    const result = rank({
      documents: [document({ id: 'd', categoryId: 'cat-insurance', expiryDate })],
    });
    expect(result.total).toBe(0);
  });

  it('no recall row when the list is unknown and the bike carries no count', () => {
    expect(rank({ recalls: null, recallCount: null }).total).toBe(0);
  });
});

describe('rankAttention — at most three rows, then "N more"', () => {
  const lateTasks = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      late(`late-${index}`, MaintenancePriority.Medium, 50 - index),
    );

  it.each([
    [0, 0, null],
    [1, 1, null],
    [ATTENTION_MAX_ROWS, ATTENTION_MAX_ROWS, null],
    [ATTENTION_MAX_ROWS + 1, ATTENTION_MAX_ROWS, 1],
    [10, ATTENTION_MAX_ROWS, 7],
  ])('%i items → %i rows, overflow %s', (count, visible, overflowCount) => {
    const result = rank({ tasks: lateTasks(count) });
    expect(result.total).toBe(count);
    expect(result.visible).toHaveLength(visible);
    expect(result.overflow?.count ?? null).toBe(overflowCount);
  });

  it('the rows and the overflow together account for every item, in rank order', () => {
    const result = rank({ tasks: lateTasks(7) });
    expect(result.visible.length + (result.overflow?.count ?? 0)).toBe(result.total);
    expect(result.visible.map((item) => item.id)).toEqual(['late-0', 'late-1', 'late-2']);
    expect(result.overflow?.titles).toEqual(['late-3', 'late-4', 'late-5', 'late-6']);
  });

  it('several recalls are one row, so they take one of the three slots', () => {
    const second = { ...ECU_RECALL, campaignNumber: '24V-999', component: 'FRONT BRAKE HOSE' };
    const result = rank({ recalls: [ECU_RECALL, second], tasks: lateTasks(2) });
    expect(result.total).toBe(3);
    expect(result.overflow).toBeNull();
    expect(result.visible[0]).toMatchObject({ kind: ATTENTION_KIND.RECALL, count: 2 });
  });

  it('a folded document is listed by its title and the overflow is not "all overdue"', () => {
    const result = rank({
      recalls: [ECU_RECALL],
      tasks: [
        late('crit', MaintenancePriority.Critical, 5),
        late('high', MaintenancePriority.High, 5),
      ],
      documents: [
        document({
          id: 'doc',
          title: 'Mapfre',
          categoryId: 'cat-insurance',
          expiryDate: iso(12),
        }),
      ],
    });
    expect(result.overflow).toEqual({
      count: 1,
      titles: ['Mapfre'],
      allOverdue: false,
      priorities: [],
    });
  });

  it('lists each folded priority once, highest first', () => {
    const result = rank({
      tasks: [
        ...lateTasks(3),
        late('low-a', MaintenancePriority.Low, 9),
        late('medium-a', MaintenancePriority.Medium, 1),
        late('low-b', MaintenancePriority.Low, 8),
      ],
    });
    expect(result.overflow).toMatchObject({
      count: 3,
      allOverdue: true,
      priorities: [MaintenancePriority.Medium, MaintenancePriority.Low],
    });
  });
});

describe('rankAttention — the Africa Twin and its Next-up task', () => {
  const bikeA = { tasks: BIKE_A_TASKS, documents: BIKE_A_DOCUMENTS, recalls: [ECU_RECALL] };

  it('the eyebrow counts 6 once the Next-up task is left out', () => {
    // Arrange
    const nextUp = getNextUp(BIKE_A_TASKS, KM);

    // Act
    const result = rank({ ...bikeA, excludeTaskIds: nextUp ? [nextUp.task.id] : [] });

    // Assert
    expect(nextUp?.task.id).toBe(AIR_FILTER.id);
    expect(result.total).toBe(6);
    expect(result.items.map((item) => item.id)).not.toContain(AIR_FILTER.id);
  });

  it('without the exclusion the same bike counts 7, the Air filter last as due soon', () => {
    const result = rank(bikeA);
    expect(result.total).toBe(7);
    expect(result.items.at(-1)?.id).toBe(AIR_FILTER.id);
  });

  it('excluding a task changes nothing else in the ranking', () => {
    const all = rank(bikeA).items.map((item) => item.id);
    const without = rank({ ...bikeA, excludeTaskIds: [AIR_FILTER.id] }).items.map(
      (item) => item.id,
    );
    expect(without).toEqual(all.filter((id) => id !== AIR_FILTER.id));
  });

  it('an excluded id that matches no task is ignored', () => {
    expect(rank({ ...bikeA, excludeTaskIds: ['no-such-task'] }).total).toBe(7);
  });

  it('excluding an overdue task removes it too — the exclusion is by id, not by state', () => {
    const result = rank({ ...bikeA, excludeTaskIds: [BRAKE_PADS.id] });
    expect(result.items.map((item) => item.id)).not.toContain(BRAKE_PADS.id);
  });
});

describe('getNextUp', () => {
  it('skips overdue and undated tasks and takes the nearest upcoming one', () => {
    const tasks = [
      late('late', MaintenancePriority.Critical, 3),
      task({ id: 'someday', title: 'someday' }),
      soon('in-20', MaintenancePriority.High, 20),
      soon('in-5', MaintenancePriority.Low, 5),
    ];
    expect(getNextUp(tasks, KM)?.task.id).toBe('in-5');
  });

  it('nearness beats priority', () => {
    const tasks = [
      soon('critical-in-25', MaintenancePriority.Critical, 25),
      soon('low-in-2', MaintenancePriority.Low, 2),
    ];
    expect(getNextUp(tasks, KM)?.task.id).toBe('low-in-2');
  });

  it('falls back to a task beyond the due-soon window when nothing is nearer', () => {
    const tasks = [task({ id: 'later', title: 'later', dueDate: iso(200) })];
    expect(getNextUp(tasks, KM)?.task.id).toBe('later');
  });

  it('compares a distance with a date at the due-soon ratio, in the bike’s unit', () => {
    // 600 mi of 1,200 is half a window; 20 days of 30 is two thirds.
    const tasks = [
      soon('in-20-days', MaintenancePriority.Medium, 20),
      task({ id: 'in-600-mi', title: 'Oil', targetMileage: 10_600 }),
    ];
    expect(getNextUp(tasks, MI)?.task.id).toBe('in-600-mi');
  });

  it('is null for a bike without tasks', () => {
    expect(getNextUp([], KM)).toBeNull();
  });

  it('ignores completed tasks', () => {
    const done = {
      ...soon('done', MaintenancePriority.High, 2),
      status: MaintenanceTaskStatus.Completed,
    };
    expect(getNextUp([done], KM)).toBeNull();
  });
});

describe('getServiceBadgeCount — overdue Critical and High only', () => {
  it.each([
    [MaintenancePriority.Critical, 1],
    [MaintenancePriority.High, 1],
    [MaintenancePriority.Medium, 0],
    [MaintenancePriority.Low, 0],
  ])('one overdue %s task → %i', (priority, expected) => {
    expect(getServiceBadgeCount([late('t', priority, 10)], KM)).toBe(expected);
  });

  it('counts each overdue Critical and High task once', () => {
    const tasks = [
      late('c1', MaintenancePriority.Critical, 1),
      late('c2', MaintenancePriority.Critical, 90),
      late('h1', MaintenancePriority.High, 5),
      late('m1', MaintenancePriority.Medium, 5),
      late('l1', MaintenancePriority.Low, 500),
    ];
    expect(getServiceBadgeCount(tasks, KM)).toBe(3);
  });

  it.each([
    ['due soon', soon('t', MaintenancePriority.Critical, 1)],
    ['due today', soon('t', MaintenancePriority.High, 0)],
    ['undated', task({ id: 't', title: 't', priority: MaintenancePriority.Critical })],
    [
      'completed',
      { ...late('t', MaintenancePriority.Critical, 10), status: MaintenanceTaskStatus.Completed },
    ],
    [
      'skipped',
      { ...late('t', MaintenancePriority.High, 10), status: MaintenanceTaskStatus.Skipped },
    ],
  ])('a Critical/High task that is %s is not counted', (_label, notCounted) => {
    expect(getServiceBadgeCount([notCounted], KM)).toBe(0);
  });

  it('counts a High task that passed its target by distance, on a miles bike', () => {
    const tasks = [
      task({
        id: 'past',
        title: 'Chain',
        priority: MaintenancePriority.High,
        targetMileage: 9_580,
      }),
      task({
        id: 'ahead',
        title: 'Oil',
        priority: MaintenancePriority.High,
        targetMileage: 10_001,
      }),
    ];
    expect(getServiceBadgeCount(tasks, MI)).toBe(1);
  });

  it('is 0 for a bike without tasks', () => {
    expect(getServiceBadgeCount([], KM)).toBe(0);
  });

  it('does not count recalls or documents — the badge is about tasks', () => {
    // The Africa Twin has a recall and an expiring document; its badge is still 1.
    expect(getServiceBadgeCount(BIKE_A_TASKS, KM)).toBe(1);
  });
});

describe('rankAttention — miles', () => {
  it('1,200 mi ahead is due soon and listed; 1,201 mi is not', () => {
    const tasks = [
      task({ id: 'at-edge', title: 'Oil', targetMileage: 11_200 }),
      task({ id: 'past-edge', title: 'Valves', targetMileage: 11_201 }),
    ];
    expect(rank({ tasks, ...MI }).items.map((item) => item.id)).toEqual(['at-edge']);
  });

  it('1,201 km ahead is still due soon on a km bike — the threshold follows the unit', () => {
    const tasks = [task({ id: 'km', title: 'Oil', targetMileage: ODOMETER + 1_201 })];
    expect(rank({ tasks }).total).toBe(1);
  });
});
