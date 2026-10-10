import { CATEGORIES, ECU_RECALL, KM } from '@/test/bike-hub-fixtures';
import { rankAttention } from '../attention';
import { ATTENTION_KIND, RIDE_STATUS } from '../constants';
import {
  applyRecallAcknowledgement,
  RECALL_ACK_ACTION,
  type RecallItem,
  type RecallResultData,
  splitRecalls,
} from '../recall-acknowledgement';
import { countOpenRecalls } from '../recall-severity';
import { getRideStatus } from '../ride-status';

const NOW = '2026-10-09T12:00:00.000Z';

function recall(campaignNumber: string, overrides: Partial<RecallItem> = {}): RecallItem {
  return {
    campaignNumber,
    reportDate: '2024-01-01',
    component: 'BRAKES',
    summary: 'summary',
    consequence: 'consequence',
    remedy: 'remedy',
    acknowledged: false,
    acknowledgedAt: null,
    ...overrides,
  };
}

function result(recalls: RecallItem[]): RecallResultData {
  const { open, done } = splitRecalls(recalls);
  return {
    count: open.length,
    acknowledgedCount: done.length,
    checkedAt: NOW,
    vinUsed: null,
    recalls: [...open, ...done],
  };
}

describe('splitRecalls', () => {
  it('keeps open recalls in server order and lists done ones most recently marked first', () => {
    const { open, done } = splitRecalls([
      recall('A'),
      recall('B', { acknowledged: true, acknowledgedAt: '2026-01-01T00:00:00Z' }),
      recall('C'),
      recall('D', { acknowledged: true, acknowledgedAt: '2026-05-01T00:00:00Z' }),
    ]);
    expect(open.map((r) => r.campaignNumber)).toEqual(['A', 'C']);
    expect(done.map((r) => r.campaignNumber)).toEqual(['D', 'B']);
  });
});

describe('applyRecallAcknowledgement', () => {
  it('marks a recall as done, moves it after the open ones and recounts', () => {
    const next = applyRecallAcknowledgement(
      result([recall('A'), recall('B')]),
      'A',
      RECALL_ACK_ACTION.ACKNOWLEDGE,
      NOW,
    );
    expect(next.count).toBe(1);
    expect(next.acknowledgedCount).toBe(1);
    expect(next.recalls.map((r) => r.campaignNumber)).toEqual(['B', 'A']);
    expect(next.recalls[1]).toMatchObject({ acknowledged: true, acknowledgedAt: NOW });
  });

  it('keeps the original date when a done recall is marked again', () => {
    const before = result([recall('A', { acknowledged: true, acknowledgedAt: '2026-01-01' })]);
    const next = applyRecallAcknowledgement(before, 'A', RECALL_ACK_ACTION.ACKNOWLEDGE, NOW);
    expect(next.recalls[0].acknowledgedAt).toBe('2026-01-01');
  });

  it('undo reopens the recall and clears its date', () => {
    const before = result([recall('A'), recall('B', { acknowledged: true, acknowledgedAt: NOW })]);
    const next = applyRecallAcknowledgement(before, 'B', RECALL_ACK_ACTION.UNACKNOWLEDGE, NOW);
    expect(next.count).toBe(2);
    expect(next.acknowledgedCount).toBe(0);
    expect(next.recalls[1]).toMatchObject({ acknowledged: false, acknowledgedAt: null });
  });

  it('leaves the result untouched for an unknown campaign', () => {
    const before = result([recall('A')]);
    expect(applyRecallAcknowledgement(before, 'Z', RECALL_ACK_ACTION.ACKNOWLEDGE, NOW)).toBe(
      before,
    );
  });
});

describe('recalls marked as done stop counting as open', () => {
  const DONE_ECU = { ...ECU_RECALL, acknowledged: true };

  it('countOpenRecalls ignores acknowledged recalls; the persisted count is the fallback', () => {
    expect(countOpenRecalls([ECU_RECALL, DONE_ECU], 9)).toBe(1);
    expect(countOpenRecalls([DONE_ECU], 9)).toBe(0);
    expect(countOpenRecalls(null, 2)).toBe(2);
  });

  it('the attention list has no recall row when every recall is done', () => {
    const { items } = rankAttention({
      tasks: [],
      documents: [],
      categories: CATEGORIES,
      recalls: [DONE_ECU],
      ...KM,
    });
    expect(items.some((item) => item.kind === ATTENTION_KIND.RECALL)).toBe(false);
  });

  it('a done recall neither names its component nor makes the row critical', () => {
    const { items } = rankAttention({
      tasks: [],
      documents: [],
      categories: CATEGORIES,
      recalls: [
        {
          ...ECU_RECALL,
          campaignNumber: 'OPEN',
          component: 'LIGHTS',
          summary: 'dim',
          consequence: 'less visible',
        },
        DONE_ECU,
      ],
      ...KM,
    });
    const row = items.find((item) => item.kind === ATTENTION_KIND.RECALL);
    expect(row).toMatchObject({ count: 1, critical: false });
  });

  it('ride status is not CHECK for a recall that is done', () => {
    const { status } = getRideStatus({
      tasks: [],
      documents: [],
      categories: CATEGORIES,
      recalls: [DONE_ECU],
      ...KM,
    });
    expect(status).toBe(RIDE_STATUS.UNTRACKED);
  });
});
