import { LANDING_SHEET, type LandingSheet } from '@/lib/landing-sheet-queue';

/**
 * What the Home owners of the two landing sheets (recall, "Service plan ready")
 * make of the data Home already has (issue 365 T16b, D11). Pure: the hook in
 * use-landing-sheets.ts feeds it and acts on the answer.
 */
export interface LandingBike {
  id: string;
  make: string;
  model: string;
  year: number;
  /** Open, unacknowledged recalls; null until the server has checked. */
  recallCount?: number | null;
}

export interface LandingTask {
  motorcycleId: string;
  completedAt?: string | null;
}

export interface LandingSheetInputs {
  /** The rider's primary bike; null when the garage is empty. */
  bike: LandingBike | null;
  /** All the rider's tasks; undefined while they load. */
  tasks: readonly LandingTask[] | undefined;
  /** The task list failed to load: decide in a later session. */
  tasksFailed?: boolean;
  isOwed: (sheet: LandingSheet) => boolean;
}

export interface LandingSheetDecision {
  /** Never needed: stop owing them. */
  drop: LandingSheet[];
  /** Not decidable this session: stay owed for a later one. */
  decline: LandingSheet[];
  /** Sheets that want to show now, in queue order (the queue picks one). */
  offer: LandingSheet[];
}

export function decideLandingSheets({
  bike,
  tasks,
  tasksFailed = false,
  isOwed,
}: LandingSheetInputs): LandingSheetDecision {
  const decision: LandingSheetDecision = { drop: [], decline: [], offer: [] };

  if (isOwed(LANDING_SHEET.RECALL)) {
    const count = bike?.recallCount;
    if (!bike || count === 0) decision.drop.push(LANDING_SHEET.RECALL);
    else if (count == null) decision.decline.push(LANDING_SHEET.RECALL);
    else decision.offer.push(LANDING_SHEET.RECALL);
  }

  if (isOwed(LANDING_SHEET.SERVICE_PLAN_READY)) {
    if (!bike) {
      decision.drop.push(LANDING_SHEET.SERVICE_PLAN_READY);
    } else if (tasksFailed) {
      decision.decline.push(LANDING_SHEET.SERVICE_PLAN_READY);
    } else if (tasks) {
      const hasOpenTask = tasks.some((task) => task.motorcycleId === bike.id && !task.completedAt);
      if (!hasOpenTask) decision.drop.push(LANDING_SHEET.SERVICE_PLAN_READY);
      else decision.offer.push(LANDING_SHEET.SERVICE_PLAN_READY);
    }
  }

  return decision;
}
