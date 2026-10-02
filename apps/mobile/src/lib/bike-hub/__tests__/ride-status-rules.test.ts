import { MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import { addDays, format } from 'date-fns';
import {
  CATEGORIES,
  document,
  ECU_RECALL,
  KM,
  ODOMETER,
  TODAY,
  task,
} from '../../../test/bike-hub-fixtures';
import { HUB_UNIT, RIDE_STATUS, RIDE_STATUS_REASON, type RideStatus } from '../constants';
import { getRideStatus, type RideStatusInput } from '../ride-status';

const iso = (deltaDays: number): string => format(addDays(TODAY, deltaDays), 'yyyy-MM-dd');

function status(overrides: Partial<RideStatusInput>) {
  return getRideStatus({
    tasks: [],
    documents: [],
    categories: CATEGORIES,
    recalls: [],
    ...KM,
    ...overrides,
  });
}

const overdue = (priority: MaintenancePriority, id = `overdue-${priority}`) =>
  task({ id, title: priority, priority, dueDate: iso(-10) });

const paper = (categoryId: string, deltaDays: number | null) =>
  document({
    id: `doc-${categoryId}`,
    categoryId,
    expiryDate: deltaDays === null ? null : iso(deltaDays),
  });

const BLOCKING_CATEGORY_IDS = ['cat-insurance', 'cat-inspection', 'cat-registration'] as const;
const NON_BLOCKING_CATEGORY_IDS = ['cat-warranty', 'cat-manual', 'cat-custom-insurance'] as const;

describe('getRideStatus — the plan’s ride-status table, row by row', () => {
  const rows: Array<[label: string, input: Partial<RideStatusInput>, expected: RideStatus]> = [
    ['overdue Critical', { tasks: [overdue(MaintenancePriority.Critical)] }, RIDE_STATUS.NOT_READY],
    ['expired Insurance', { documents: [paper('cat-insurance', -1)] }, RIDE_STATUS.NOT_READY],
    [
      'expired Warranty (non-blocking)',
      { documents: [paper('cat-warranty', -1)] },
      RIDE_STATUS.READY,
    ],
    ['overdue High only', { tasks: [overdue(MaintenancePriority.High)] }, RIDE_STATUS.CHECK],
    [
      'Registration expiring in 30 days',
      { documents: [paper('cat-registration', 30)] },
      RIDE_STATUS.CHECK,
    ],
    [
      'Registration expiring in 31 days',
      { documents: [paper('cat-registration', 31)] },
      RIDE_STATUS.READY,
    ],
    [
      'overdue Low + Medium only',
      { tasks: [overdue(MaintenancePriority.Low), overdue(MaintenancePriority.Medium)] },
      RIDE_STATUS.READY,
    ],
    ['one recall and nothing else', { recalls: [ECU_RECALL] }, RIDE_STATUS.CHECK],
    ['no tasks, no documents, no recalls', {}, RIDE_STATUS.UNTRACKED],
    [
      'custom category named "Insurance" expired',
      { documents: [paper('cat-custom-insurance', -1)] },
      RIDE_STATUS.READY,
    ],
  ];

  it.each(rows)('%s → %s', (_label, input, expected) => {
    expect(status(input).status).toBe(expected);
  });
});

describe('getRideStatus — blocking documents', () => {
  it.each(BLOCKING_CATEGORY_IDS)('an expired %s document makes the bike NOT_READY', (id) => {
    expect(status({ documents: [paper(id, -1)] }).status).toBe(RIDE_STATUS.NOT_READY);
  });

  it.each(BLOCKING_CATEGORY_IDS)('a %s document expiring inside 30 days asks to CHECK', (id) => {
    expect(status({ documents: [paper(id, 12)] }).status).toBe(RIDE_STATUS.CHECK);
  });

  it.each(
    NON_BLOCKING_CATEGORY_IDS,
  )('a %s document never changes the status, expired or expiring', (id) => {
    expect(status({ documents: [paper(id, -40)] }).status).toBe(RIDE_STATUS.READY);
    expect(status({ documents: [paper(id, 3)] }).status).toBe(RIDE_STATUS.READY);
  });

  it.each([
    [-1, RIDE_STATUS.NOT_READY],
    [0, RIDE_STATUS.CHECK],
    [1, RIDE_STATUS.CHECK],
    [29, RIDE_STATUS.CHECK],
    [30, RIDE_STATUS.CHECK],
    [31, RIDE_STATUS.READY],
  ])('Insurance expiring in %i days → %s', (days, expected) => {
    expect(status({ documents: [paper('cat-insurance', days)] }).status).toBe(expected);
  });

  it('a document that expires today is expiring, not expired', () => {
    expect(status({ documents: [paper('cat-insurance', 0)] }).reasons).toEqual([
      { kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRING, categoryName: 'Insurance', days: 0 },
    ]);
  });

  it('a blocking document without an expiry date counts as tracked and nothing more', () => {
    expect(status({ documents: [paper('cat-insurance', null)] })).toEqual({
      status: RIDE_STATUS.READY,
      reasons: [],
    });
  });

  it('a document whose category cannot be resolved never blocks', () => {
    expect(status({ documents: [paper('cat-deleted', -5)] }).status).toBe(RIDE_STATUS.READY);
  });

  it('a custom "Insurance" beside a seeded one: only the seeded document counts', () => {
    const result = status({
      documents: [paper('cat-custom-insurance', -5), paper('cat-insurance', 12)],
    });
    expect(result.status).toBe(RIDE_STATUS.CHECK);
    expect(result.reasons).toEqual([
      { kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRING, categoryName: 'Insurance', days: 12 },
    ]);
  });
});

describe('getRideStatus — overdue Low and Medium never change it', () => {
  const lowAndMedium = [overdue(MaintenancePriority.Low), overdue(MaintenancePriority.Medium)];

  const baselines: Array<[label: string, input: Partial<RideStatusInput>]> = [
    ['READY (a stored document)', { documents: [paper('cat-manual', null)] }],
    ['CHECK (an open recall)', { recalls: [ECU_RECALL] }],
    ['CHECK (an overdue High task)', { tasks: [overdue(MaintenancePriority.High)] }],
    ['NOT_READY (an overdue Critical task)', { tasks: [overdue(MaintenancePriority.Critical)] }],
    ['NOT_READY (expired Insurance)', { documents: [paper('cat-insurance', -2)] }],
  ];

  it.each(baselines)('%s keeps its status and its reasons', (_label, input) => {
    // Arrange
    const before = status(input);

    // Act
    const after = status({ ...input, tasks: [...(input.tasks ?? []), ...lowAndMedium] });

    // Assert
    expect(after).toEqual(before);
  });

  it('many overdue Low and Medium tasks are still READY', () => {
    const tasks = Array.from({ length: 12 }, (_, index) =>
      overdue(
        index % 2 === 0 ? MaintenancePriority.Low : MaintenancePriority.Medium,
        `late-${index}`,
      ),
    );
    expect(status({ tasks })).toEqual({ status: RIDE_STATUS.READY, reasons: [] });
  });
});

describe('getRideStatus — what counts as overdue', () => {
  it('a Critical task is overdue once the odometer reaches its target, in km', () => {
    const atTarget = task({
      id: 'crit',
      title: 'Rear brake shoes',
      priority: MaintenancePriority.Critical,
      targetMileage: ODOMETER,
    });
    expect(status({ tasks: [atTarget] }).status).toBe(RIDE_STATUS.NOT_READY);
  });

  it('a High task 420 mi past its target asks to CHECK on a miles bike', () => {
    const past = task({
      id: 'high',
      title: 'Chain tension',
      priority: MaintenancePriority.High,
      targetMileage: 10_000,
    });
    const result = status({ tasks: [past], odometer: 10_420, unit: HUB_UNIT.MI });
    expect(result).toEqual({
      status: RIDE_STATUS.CHECK,
      reasons: [{ kind: RIDE_STATUS_REASON.OVERDUE_HIGH, count: 1 }],
    });
  });

  it('a Critical task that is only due soon does not block', () => {
    const soon = task({
      id: 'crit',
      title: 'Brake fluid',
      priority: MaintenancePriority.Critical,
      dueDate: iso(2),
    });
    expect(status({ tasks: [soon] }).status).toBe(RIDE_STATUS.READY);
  });

  it('a Critical task due today has not passed yet', () => {
    const dueToday = task({
      id: 'crit',
      title: 'Brake fluid',
      priority: MaintenancePriority.Critical,
      dueDate: iso(0),
    });
    expect(status({ tasks: [dueToday] }).status).toBe(RIDE_STATUS.READY);
  });

  it('an in-progress overdue Critical task still blocks', () => {
    const inProgress = {
      ...overdue(MaintenancePriority.Critical),
      status: MaintenanceTaskStatus.InProgress,
    };
    expect(status({ tasks: [inProgress] }).status).toBe(RIDE_STATUS.NOT_READY);
  });

  it.each([
    MaintenanceTaskStatus.Completed,
    MaintenanceTaskStatus.Skipped,
  ])('a %s Critical task with a past date is history, not a blocker', (taskStatus) => {
    const closed = { ...overdue(MaintenancePriority.Critical), status: taskStatus };
    expect(status({ tasks: [closed] })).toEqual({ status: RIDE_STATUS.READY, reasons: [] });
  });

  it('counts every overdue Critical and High task in its reason', () => {
    const result = status({
      tasks: [
        overdue(MaintenancePriority.Critical, 'c1'),
        overdue(MaintenancePriority.Critical, 'c2'),
        overdue(MaintenancePriority.High, 'h1'),
        overdue(MaintenancePriority.High, 'h2'),
        overdue(MaintenancePriority.High, 'h3'),
      ],
    });
    expect(result.reasons).toEqual([
      { kind: RIDE_STATUS_REASON.OVERDUE_CRITICAL, count: 2 },
      { kind: RIDE_STATUS_REASON.OVERDUE_HIGH, count: 3 },
    ]);
  });
});

describe('getRideStatus — recalls and "nothing tracked"', () => {
  it('a recall alone is CHECK, never UNTRACKED', () => {
    expect(status({ recalls: [ECU_RECALL] })).toEqual({
      status: RIDE_STATUS.CHECK,
      reasons: [{ kind: RIDE_STATUS_REASON.OPEN_RECALLS, count: 1 }],
    });
  });

  it('a recall does not lift an overdue Critical task out of NOT_READY', () => {
    expect(
      status({ tasks: [overdue(MaintenancePriority.Critical)], recalls: [ECU_RECALL] }).status,
    ).toBe(RIDE_STATUS.NOT_READY);
  });

  it.each([
    ['an empty recall list', { recalls: [] }],
    ['recalls still loading and no persisted count', { recalls: null, recallCount: null }],
    ['recalls failed and a persisted count of 0', { recalls: null, recallCount: 0 }],
  ] satisfies Array<
    [string, Partial<RideStatusInput>]
  >)('is UNTRACKED with %s', (_label, input) => {
    expect(status(input)).toEqual({ status: RIDE_STATUS.UNTRACKED, reasons: [] });
  });

  it.each([
    [
      'one active task far in the future',
      { tasks: [task({ id: 't', title: 't', dueDate: iso(300) })] },
    ],
    ['one undated task', { tasks: [task({ id: 't', title: 't' })] }],
    ['one stored document', { documents: [paper('cat-manual', null)] }],
  ] satisfies Array<
    [string, Partial<RideStatusInput>]
  >)('is READY, not UNTRACKED, with %s', (_label, input) => {
    expect(status(input)).toEqual({ status: RIDE_STATUS.READY, reasons: [] });
  });

  it('is UNTRACKED on a bike whose odometer was never set', () => {
    expect(status({ odometer: null }).status).toBe(RIDE_STATUS.UNTRACKED);
  });
});

describe('getRideStatus — purity', () => {
  it('gives the same answer twice and leaves its inputs untouched', () => {
    // Arrange
    const tasks = Object.freeze([
      overdue(MaintenancePriority.High),
      overdue(MaintenancePriority.Low),
    ]);
    const documents = Object.freeze([paper('cat-insurance', 12)]);
    const input = { tasks, documents, recalls: Object.freeze([ECU_RECALL]) };

    // Act
    const first = status(input);
    const second = status(input);

    // Assert
    expect(second).toEqual(first);
    expect(first.status).toBe(RIDE_STATUS.CHECK);
  });
});
