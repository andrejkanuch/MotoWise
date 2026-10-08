import { MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import { addDays, format } from 'date-fns';
import {
  AIR_FILTER,
  BIKE_A_DOCUMENTS,
  BIKE_A_TASKS,
  BRAKE_PADS,
  CATEGORIES,
  COOLANT,
  document,
  ECU_RECALL,
  KM,
  TODAY,
  task,
} from '../../../test/bike-hub-fixtures';
import { getNextUp, getServiceBadgeCount, rankAttention } from '../attention';
import { ATTENTION_KIND, RECALL_SEVERITY, RIDE_STATUS, RIDE_STATUS_REASON } from '../constants';
import { getRecallSeverity } from '../recall-severity';
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

const overdue = (priority: MaintenancePriority) =>
  task({ id: `overdue-${priority}`, title: priority, priority, dueDate: iso(-10) });

describe('getRideStatus — bike A', () => {
  it('is CHECK with "1 open recall · 1 overdue high task · insurance expires in 12 days"', () => {
    const result = status({
      tasks: BIKE_A_TASKS,
      documents: BIKE_A_DOCUMENTS,
      recalls: [ECU_RECALL],
    });
    expect(result.status).toBe(RIDE_STATUS.CHECK);
    expect(result.reasons).toEqual([
      { kind: RIDE_STATUS_REASON.OPEN_RECALLS, count: 1 },
      { kind: RIDE_STATUS_REASON.OVERDUE_HIGH, count: 1 },
      { kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRING, categoryName: 'Insurance', days: 12 },
    ]);
  });
});

describe('getRideStatus — table', () => {
  it('overdue Critical → NOT_READY', () => {
    expect(status({ tasks: [overdue(MaintenancePriority.Critical)] }).status).toBe(
      RIDE_STATUS.NOT_READY,
    );
  });

  it('expired Insurance → NOT_READY', () => {
    const result = status({
      documents: [document({ id: 'd', categoryId: 'cat-insurance', expiryDate: iso(-3) })],
    });
    expect(result.status).toBe(RIDE_STATUS.NOT_READY);
    expect(result.reasons).toEqual([
      { kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRED, categoryName: 'Insurance', days: 3 },
    ]);
  });

  it('expired Warranty (non-blocking) → unchanged', () => {
    expect(
      status({
        documents: [document({ id: 'd', categoryId: 'cat-warranty', expiryDate: iso(-3) })],
      }).status,
    ).toBe(RIDE_STATUS.READY);
  });

  it('overdue High only → CHECK', () => {
    expect(status({ tasks: [overdue(MaintenancePriority.High)] }).status).toBe(RIDE_STATUS.CHECK);
  });

  it('Registration expiring in 30 days → CHECK, in 31 → READY', () => {
    const registration = (days: number) =>
      status({
        documents: [document({ id: 'd', categoryId: 'cat-registration', expiryDate: iso(days) })],
      }).status;
    expect(registration(30)).toBe(RIDE_STATUS.CHECK);
    expect(registration(31)).toBe(RIDE_STATUS.READY);
  });

  it('overdue Low + Medium only → READY', () => {
    expect(
      status({ tasks: [overdue(MaintenancePriority.Low), overdue(MaintenancePriority.Medium)] })
        .status,
    ).toBe(RIDE_STATUS.READY);
  });

  it('one recall and nothing else → CHECK', () => {
    expect(status({ recalls: [ECU_RECALL] }).status).toBe(RIDE_STATUS.CHECK);
  });

  it('no tasks, no documents, no recalls → UNTRACKED', () => {
    expect(status({})).toEqual({ status: RIDE_STATUS.UNTRACKED, reasons: [] });
  });

  it('custom category named "Insurance" expired → unchanged', () => {
    expect(
      status({
        documents: [document({ id: 'd', categoryId: 'cat-custom-insurance', expiryDate: iso(-3) })],
      }).status,
    ).toBe(RIDE_STATUS.READY);
  });

  it('a completed task counts as tracked and never as overdue', () => {
    const done = {
      ...overdue(MaintenancePriority.Critical),
      status: MaintenanceTaskStatus.Completed,
    };
    expect(status({ tasks: [done] }).status).toBe(RIDE_STATUS.READY);
  });

  it('falls back to the persisted recall count while the recall list is unknown', () => {
    const result = status({ recalls: null, recallCount: 2 });
    expect(result.status).toBe(RIDE_STATUS.CHECK);
    expect(result.reasons).toEqual([{ kind: RIDE_STATUS_REASON.OPEN_RECALLS, count: 2 }]);
  });

  it('NOT_READY lists the blocking reasons before the check-level ones', () => {
    const result = status({
      tasks: [overdue(MaintenancePriority.High), overdue(MaintenancePriority.Critical)],
      recalls: [ECU_RECALL],
    });
    expect(result.reasons.map((reason) => reason.kind)).toEqual([
      RIDE_STATUS_REASON.OVERDUE_CRITICAL,
      RIDE_STATUS_REASON.OPEN_RECALLS,
      RIDE_STATUS_REASON.OVERDUE_HIGH,
    ]);
  });
});

describe('rankAttention — bike A', () => {
  const result = rankAttention({
    tasks: BIKE_A_TASKS,
    documents: BIKE_A_DOCUMENTS,
    categories: CATEGORIES,
    recalls: [ECU_RECALL],
    excludeTaskIds: [AIR_FILTER.id],
    ...KM,
  });

  it('counts 6: 1 recall + 1 overdue high + 1 document + 3 other overdue', () => {
    expect(result.total).toBe(6);
  });

  it('shows recall → Brake pads inspection → Insurance', () => {
    expect(result.visible.map((item) => item.kind)).toEqual([
      ATTENTION_KIND.RECALL,
      ATTENTION_KIND.TASK,
      ATTENTION_KIND.DOCUMENT,
    ]);
    expect(result.visible[0]).toMatchObject({ count: 1, critical: true });
    expect(result.visible[1]).toMatchObject({ id: BRAKE_PADS.id });
    expect(result.visible[2]).toMatchObject({
      signal: { categoryName: 'Insurance', expired: false, days: 12 },
    });
  });

  it('folds the rest into "3 more overdue, medium and low"', () => {
    expect(result.overflow).toEqual({
      count: 3,
      titles: ['Coolant', 'Tire pressure', 'Chain clean & lube'],
      allOverdue: true,
      priorities: [MaintenancePriority.Medium, MaintenancePriority.Low],
    });
  });
});

describe('rankAttention — variants', () => {
  const base = { documents: [], categories: CATEGORIES, recalls: [], ...KM };

  it('one item: a single row and no overflow', () => {
    const result = rankAttention({ ...base, tasks: [BRAKE_PADS] });
    expect(result.total).toBe(1);
    expect(result.overflow).toBeNull();
  });

  it('nothing to attend to: empty', () => {
    expect(rankAttention({ ...base, tasks: [] }).total).toBe(0);
  });

  it('ranks due-soon tasks last and includes them when not excluded', () => {
    const result = rankAttention({ ...base, tasks: [AIR_FILTER, COOLANT] });
    expect(result.items.map((item) => item.id)).toEqual([COOLANT.id, AIR_FILTER.id]);
  });

  it('overflow that mixes a due-soon task is not "all overdue"', () => {
    const result = rankAttention({ ...base, tasks: BIKE_A_TASKS });
    expect(result.overflow).toMatchObject({ count: 2, allOverdue: false });
  });

  it('groups several recalls into one row and flags a critical one', () => {
    const result = rankAttention({
      ...base,
      tasks: [],
      recalls: [
        ECU_RECALL,
        {
          campaignNumber: '2',
          component: 'HANDLEBAR SWITCH',
          summary: 'Wear',
          consequence: 'None',
        },
      ],
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ count: 2, critical: true });
  });

  it('uses the persisted count with no detail while recalls are unknown', () => {
    const result = rankAttention({ ...base, tasks: [], recalls: null, recallCount: 1 });
    expect(result.items[0]).toMatchObject({ count: 1, components: [], critical: false });
  });

  it('puts an expired document before an expiring one', () => {
    const result = rankAttention({
      ...base,
      tasks: [],
      documents: [
        document({ id: 'soon', categoryId: 'cat-insurance', expiryDate: iso(5) }),
        document({ id: 'gone', categoryId: 'cat-warranty', expiryDate: iso(-5) }),
        document({ id: 'far', categoryId: 'cat-inspection', expiryDate: iso(200) }),
      ],
    });
    expect(result.items.map((item) => item.id)).toEqual(['gone', 'soon']);
  });
});

describe('getNextUp / getServiceBadgeCount', () => {
  it('next up on bike A is the Air filter', () => {
    expect(getNextUp(BIKE_A_TASKS, KM)?.task.id).toBe(AIR_FILTER.id);
  });

  it('there is no next up when everything is overdue or undated', () => {
    expect(getNextUp([BRAKE_PADS, task({ id: 'x', title: 'someday' })], KM)).toBeNull();
  });

  it('the Service badge counts every overdue task: 4 on bike A', () => {
    expect(getServiceBadgeCount(BIKE_A_TASKS, KM)).toBe(4);
  });
});

describe('getRecallSeverity', () => {
  it('is critical when the text mentions a stall', () => {
    expect(getRecallSeverity(ECU_RECALL)).toBe(RECALL_SEVERITY.CRITICAL);
  });

  it('matches keywords case-insensitively in any field', () => {
    expect(
      getRecallSeverity({ component: 'SERVICE BRAKES', summary: 'Wear', consequence: 'None' }),
    ).toBe(RECALL_SEVERITY.CRITICAL);
  });

  it('is high otherwise', () => {
    expect(
      getRecallSeverity({ component: 'LABELS', summary: 'Wrong sticker', consequence: 'None' }),
    ).toBe(RECALL_SEVERITY.HIGH);
  });
});
