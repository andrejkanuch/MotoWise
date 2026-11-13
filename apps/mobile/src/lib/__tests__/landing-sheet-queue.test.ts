// The landing-sheet queue (issue 365 T16b, FS-PO17, owner ruling D11): at most
// one modal sheet over Home per cold session. Order: safety recall, then
// "Service plan ready" (the OEM-imported sheet); What's New and check-in never
// in the session the rider landed from onboarding. The Exp 1 plan card is an
// inline card that may show only when no sheet showed.
jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());
jest.mock('../analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../onboarding-experiment', () => ({ getOnboardingVariant: () => 'shipped' }));

import {
  createLandingSheetQueue,
  LANDING_SHEET,
  LANDING_SHEET_ORDER,
  LANDING_SHEET_TEST_ID,
  type LandingSheet,
  type LandingSheetMemory,
} from '../landing-sheet-queue';

/** One install's persisted memory, shared by the cold sessions it creates. */
function install() {
  let landingSessionId: string | null = null;
  let owed: LandingSheet[] = [];
  const memory: LandingSheetMemory = {
    read: () => ({ landingSessionId, owed }),
    noteLanding: (sessionId, sheets) => {
      landingSessionId = sessionId;
      owed = [...sheets];
    },
    settle: (sheet) => {
      owed = owed.filter((s) => s !== sheet);
    },
  };
  let sessions = 0;
  const track = jest.fn();
  return {
    track,
    owed: () => owed,
    /** A new cold start of the app (a new JS process). */
    coldSession: () => {
      sessions += 1;
      return createLandingSheetQueue({ sessionId: `session-${sessions}`, memory, track });
    },
  };
}

describe('landing-sheet queue (D11)', () => {
  it('shows only the recall sheet when recall and Service plan ready are both requested on landing', () => {
    const app = install();
    const first = app.coldSession();
    first.noteLanding();

    const shown = [LANDING_SHEET.RECALL, LANDING_SHEET.SERVICE_PLAN_READY].filter((sheet) =>
      first.request(sheet),
    );

    expect(shown).toEqual([LANDING_SHEET.RECALL]);
    expect(first.shownThisSession()).toBe(LANDING_SHEET.RECALL);
    expect(app.track).toHaveBeenCalledTimes(1);
    expect(app.track).toHaveBeenCalledWith(LANDING_SHEET.RECALL, 0);
  });

  it('defers Service plan ready to the next cold session, still one sheet in it', () => {
    const app = install();
    const first = app.coldSession();
    first.noteLanding();
    first.request(LANDING_SHEET.RECALL);
    expect(first.request(LANDING_SHEET.SERVICE_PLAN_READY)).toBe(false);
    expect(app.owed()).toEqual([LANDING_SHEET.SERVICE_PLAN_READY]);

    const second = app.coldSession();
    expect(second.request(LANDING_SHEET.SERVICE_PLAN_READY)).toBe(true);
    expect(second.request(LANDING_SHEET.WHATS_NEW)).toBe(false);
    expect(app.owed()).toEqual([]);
    expect(app.track).toHaveBeenLastCalledWith(LANDING_SHEET.SERVICE_PLAN_READY, 1);
  });

  it('makes Service plan ready wait while the recall sheet is still undecided', () => {
    const app = install();
    const first = app.coldSession();
    first.noteLanding();

    // The recall owner has not reported yet: Service plan ready must not jump the queue.
    expect(first.request(LANDING_SHEET.SERVICE_PLAN_READY)).toBe(false);
    expect(first.shownThisSession()).toBeNull();

    // No recall for this bike: the next sheet in order may show.
    first.drop(LANDING_SHEET.RECALL);
    expect(first.request(LANDING_SHEET.SERVICE_PLAN_READY)).toBe(true);
  });

  it("keeps What's New and check-in out of the landing session and lets them in from the next one", () => {
    const app = install();
    const first = app.coldSession();
    first.noteLanding();
    first.drop(LANDING_SHEET.RECALL);
    first.drop(LANDING_SHEET.SERVICE_PLAN_READY);

    expect(first.request(LANDING_SHEET.WHATS_NEW)).toBe(false);
    expect(first.request(LANDING_SHEET.CHECK_IN)).toBe(false);
    expect(first.shownThisSession()).toBeNull();

    const second = app.coldSession();
    expect(second.request(LANDING_SHEET.WHATS_NEW)).toBe(true);
    // Still one sheet per session.
    expect(second.request(LANDING_SHEET.CHECK_IN)).toBe(false);

    const third = app.coldSession();
    expect(third.request(LANDING_SHEET.CHECK_IN)).toBe(true);
  });

  it('lets a declined sheet stay owed for a later session without blocking this one', () => {
    const app = install();
    const first = app.coldSession();
    first.noteLanding();
    // Recall count not known yet (lookup pending on the server): skip this session only.
    first.decline(LANDING_SHEET.RECALL);
    expect(first.request(LANDING_SHEET.SERVICE_PLAN_READY)).toBe(true);
    expect(app.owed()).toEqual([LANDING_SHEET.RECALL]);

    const second = app.coldSession();
    expect(second.request(LANDING_SHEET.RECALL)).toBe(true);
  });

  it('owes no landing sheet to a rider who did not land from onboarding on this install', () => {
    const app = install();
    const session = app.coldSession();
    expect(session.isOwed(LANDING_SHEET.RECALL)).toBe(false);
    expect(session.isOwed(LANDING_SHEET.SERVICE_PLAN_READY)).toBe(false);
    expect(session.request(LANDING_SHEET.WHATS_NEW)).toBe(true);
  });

  it('lets the Exp 1 plan card show only when no sheet showed this session', () => {
    const app = install();
    const first = app.coldSession();
    first.noteLanding();
    expect(first.mayShowPlanCard()).toBe(true);
    first.request(LANDING_SHEET.RECALL);
    expect(first.mayShowPlanCard()).toBe(false);

    const second = app.coldSession();
    second.drop(LANDING_SHEET.SERVICE_PLAN_READY);
    expect(second.mayShowPlanCard()).toBe(true);
  });

  it('tells subscribers when the queue changes, so waiting owners re-ask', () => {
    const app = install();
    const first = app.coldSession();
    const listener = jest.fn();
    const unsubscribe = first.subscribe(listener);
    first.noteLanding();
    first.drop(LANDING_SHEET.RECALL);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    first.request(LANDING_SHEET.SERVICE_PLAN_READY);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('names every sheet in order with the testIDs the Maestro guard reads', () => {
    expect(LANDING_SHEET_ORDER).toEqual([
      LANDING_SHEET.RECALL,
      LANDING_SHEET.SERVICE_PLAN_READY,
      LANDING_SHEET.WHATS_NEW,
      LANDING_SHEET.CHECK_IN,
    ]);
    expect(LANDING_SHEET_TEST_ID).toEqual({
      [LANDING_SHEET.RECALL]: 'recall-sheet',
      [LANDING_SHEET.SERVICE_PLAN_READY]: 'oem-imported-sheet',
      [LANDING_SHEET.WHATS_NEW]: 'whats-new-sheet',
    });
  });
});
