jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('@/lib/analytics', () => require('@/test/mocks').mockAnalytics());
jest.mock('@/lib/onboarding-experiment', () => ({ getOnboardingVariant: () => 'shipped' }));

import { LANDING_SHEET, type LandingSheet } from '@/lib/landing-sheet-queue';
import { decideLandingSheets } from '../landing-sheet-owners';

const BIKE = { id: 'bike-1', make: 'Yamaha', model: 'MT-09', year: 2019 };
const bothOwed = (sheet: LandingSheet) =>
  sheet === LANDING_SHEET.RECALL || sheet === LANDING_SHEET.SERVICE_PLAN_READY;

describe('decideLandingSheets', () => {
  it('offers recall then Service plan ready for a bike with an open recall and imported tasks', () => {
    const decision = decideLandingSheets({
      bike: { ...BIKE, recallCount: 1 },
      tasks: [{ motorcycleId: 'bike-1', completedAt: null }],
      isOwed: bothOwed,
    });
    expect(decision.offer).toEqual([LANDING_SHEET.RECALL, LANDING_SHEET.SERVICE_PLAN_READY]);
    expect(decision.drop).toEqual([]);
  });

  it('drops both when the bike has no recall and no open task', () => {
    const decision = decideLandingSheets({
      bike: { ...BIKE, recallCount: 0 },
      tasks: [
        { motorcycleId: 'bike-1', completedAt: '2026-11-01' },
        { motorcycleId: 'other-bike', completedAt: null },
      ],
      isOwed: bothOwed,
    });
    expect(decision.drop).toEqual([LANDING_SHEET.RECALL, LANDING_SHEET.SERVICE_PLAN_READY]);
    expect(decision.offer).toEqual([]);
  });

  it('declines (stays owed) when the recall count is unknown or the tasks failed', () => {
    const decision = decideLandingSheets({
      bike: { ...BIKE, recallCount: null },
      tasks: undefined,
      tasksFailed: true,
      isOwed: bothOwed,
    });
    expect(decision.decline).toEqual([LANDING_SHEET.RECALL, LANDING_SHEET.SERVICE_PLAN_READY]);
  });

  it('waits for tasks that are still loading', () => {
    const decision = decideLandingSheets({
      bike: { ...BIKE, recallCount: 0 },
      tasks: undefined,
      isOwed: bothOwed,
    });
    expect(decision).toEqual({ drop: [LANDING_SHEET.RECALL], decline: [], offer: [] });
  });

  it('drops both for an empty garage and decides nothing that is not owed', () => {
    expect(decideLandingSheets({ bike: null, tasks: [], isOwed: bothOwed }).drop).toEqual([
      LANDING_SHEET.RECALL,
      LANDING_SHEET.SERVICE_PLAN_READY,
    ]);
    expect(
      decideLandingSheets({ bike: { ...BIKE, recallCount: 3 }, tasks: [], isOwed: () => false }),
    ).toEqual({ drop: [], decline: [], offer: [] });
  });
});
