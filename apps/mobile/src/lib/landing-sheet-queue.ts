import { useLandingSheetsStore } from '../stores/landing-sheets.store';
import { trackLandingSheetShown } from './post-onboarding-landing';

/**
 * The landing-sheet queue (issue 365 T16b, friction spec FS-PO17, owner ruling
 * D11): every owner of a modal sheet over Home asks here before showing it.
 *
 * - At most one modal sheet per cold session (a cold session is the JS process).
 * - Order: safety recall for the rider's bike, then "Service plan ready" (the
 *   OEM-imported sheet), then What's New, then check-in. A sheet waits while a
 *   sheet before it is still owed and undecided this session, so a fast owner
 *   cannot jump the queue.
 * - Recall and "Service plan ready" are owed only to a rider who landed on Home
 *   from onboarding on this install; one that loses to a higher sheet stays owed
 *   and shows in a later cold session.
 * - What's New and check-in never show in the session the rider landed in.
 * - Analytics consent is an earlier gate (owners wait for it themselves) and the
 *   onboarding paywall is never part of the queue.
 * - The Exp 1 plan card is an inline Home card: `mayShowPlanCard()` is true only
 *   while no sheet has shown this session.
 *
 * Every sheet that shows is reported as `landing_sheet_shown {sheet,
 * ms_since_landed, queue_position}`, `queue_position` being its place in the order.
 */
export const LANDING_SHEET = {
  RECALL: 'recall',
  SERVICE_PLAN_READY: 'oem_imported',
  WHATS_NEW: 'whats_new',
  CHECK_IN: 'check_in',
} as const;
export type LandingSheet = (typeof LANDING_SHEET)[keyof typeof LANDING_SHEET];

export const LANDING_SHEET_ORDER: readonly LandingSheet[] = [
  LANDING_SHEET.RECALL,
  LANDING_SHEET.SERVICE_PLAN_READY,
  LANDING_SHEET.WHATS_NEW,
  LANDING_SHEET.CHECK_IN,
];

/** The root testID of each sheet with a screen (the FS-PO17 Maestro guard reads them). */
export const LANDING_SHEET_TEST_ID = {
  [LANDING_SHEET.RECALL]: 'recall-sheet',
  [LANDING_SHEET.SERVICE_PLAN_READY]: 'oem-imported-sheet',
  [LANDING_SHEET.WHATS_NEW]: 'whats-new-sheet',
} as const;
export const RECALL_SHEET_TEST_ID = LANDING_SHEET_TEST_ID[LANDING_SHEET.RECALL];

/** Owed to a rider who landed from onboarding; everything else decides for itself. */
const LANDING_OWED: readonly LandingSheet[] = [
  LANDING_SHEET.RECALL,
  LANDING_SHEET.SERVICE_PLAN_READY,
];
/** Never in the session the rider landed in. */
const LATER_SESSION_ONLY: ReadonlySet<LandingSheet> = new Set([
  LANDING_SHEET.WHATS_NEW,
  LANDING_SHEET.CHECK_IN,
]);

export interface LandingSheetMemory {
  read: () => { landingSessionId: string | null; owed: readonly string[] };
  noteLanding: (sessionId: string, sheets: readonly LandingSheet[]) => void;
  settle: (sheet: LandingSheet) => void;
}

interface QueueDeps {
  sessionId: string;
  memory: LandingSheetMemory;
  track: (sheet: LandingSheet, queuePosition: number) => void;
}

export function createLandingSheetQueue({ sessionId, memory, track }: QueueDeps) {
  let shown: LandingSheet | null = null;
  const declined = new Set<LandingSheet>();
  const listeners = new Set<() => void>();
  let version = 0;

  const notify = () => {
    version += 1;
    for (const listener of listeners) listener();
  };
  const isOwed = (sheet: LandingSheet) => memory.read().owed.includes(sheet);
  const isLandingSession = () => memory.read().landingSessionId === sessionId;

  const canRequest = (sheet: LandingSheet): boolean => {
    if (shown !== null) return false;
    if (LANDING_OWED.includes(sheet) && !isOwed(sheet)) return false;
    if (LATER_SESSION_ONLY.has(sheet) && isLandingSession()) return false;
    const before = LANDING_SHEET_ORDER.slice(0, LANDING_SHEET_ORDER.indexOf(sheet));
    return !before.some((earlier) => isOwed(earlier) && !declined.has(earlier));
  };

  return {
    /** The rider landed on Home from onboarding in this session. */
    noteLanding() {
      memory.noteLanding(sessionId, LANDING_OWED);
      notify();
    },
    isOwed,
    /** Whether `sheet` would be allowed now, without claiming the session's slot. */
    canRequest,
    /** Claims the session's one sheet for `sheet`; false means do not show it (now). */
    request(sheet: LandingSheet): boolean {
      if (!canRequest(sheet)) return false;
      shown = sheet;
      if (LANDING_OWED.includes(sheet)) memory.settle(sheet);
      track(sheet, LANDING_SHEET_ORDER.indexOf(sheet));
      notify();
      return true;
    },
    /** The owner has nothing to show this session; it stays owed for a later one. */
    decline(sheet: LandingSheet) {
      if (declined.has(sheet)) return;
      declined.add(sheet);
      notify();
    },
    /** The sheet will never be needed (no recall, no service plan): stop owing it. */
    drop(sheet: LandingSheet) {
      if (!isOwed(sheet)) return;
      memory.settle(sheet);
      notify();
    },
    shownThisSession: () => shown,
    /** The Exp 1 plan card (an inline Home card) may show only when no sheet did. */
    mayShowPlanCard: () => shown === null,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getVersion: () => version,
  };
}

export type LandingSheetQueue = ReturnType<typeof createLandingSheetQueue>;

const storeMemory: LandingSheetMemory = {
  read: () => useLandingSheetsStore.getState(),
  noteLanding: (sessionId, sheets) =>
    useLandingSheetsStore.getState().noteLanding(sessionId, sheets),
  settle: (sheet) => useLandingSheetsStore.getState().settle(sheet),
};

/** The app's one queue; its session is this JS process. */
export const landingSheetQueue = createLandingSheetQueue({
  sessionId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
  memory: storeMemory,
  track: trackLandingSheetShown,
});
