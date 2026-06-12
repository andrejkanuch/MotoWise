import type { GqlMaintenancePriority } from '../../common/enums/graphql-enums';
import type { OemSchedule } from '../oem-schedules/models/oem-schedule.model';

/**
 * Rough per-task service cost (parts + indicative labour) in EUR, by the
 * keyword found in the OEM task name. These are deliberately conservative
 * round figures — the Reveal copy hedges ("about €X") and the goal is an
 * order-of-magnitude "first year costs roughly this", not a quote.
 *
 * Source: the cost ranges in onboarding-aha-moment.md; refine into a DB table
 * with regional pricing later (tracked in the plan, W6 note).
 */
const TASK_COST_EUR: ReadonlyArray<{ match: RegExp; cost: number }> = [
  { match: /valve|clearance/i, cost: 220 },
  { match: /oil|filter/i, cost: 70 },
  { match: /chain|sprocket/i, cost: 45 },
  { match: /brake|pad|fluid/i, cost: 60 },
  { match: /tyre|tire/i, cost: 180 },
  { match: /coolant|radiator/i, cost: 55 },
  { match: /spark|plug/i, cost: 40 },
  { match: /air\s?filter|intake/i, cost: 35 },
  { match: /battery/i, cost: 50 },
  { match: /inspection|service|general/i, cost: 90 },
];

const DEFAULT_TASK_COST_EUR = 50;

/** Priority weighting — critical tasks rarely slip a year; low ones often do. */
const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 1,
  high: 1,
  medium: 0.8,
  low: 0.5,
};

function costForTask(taskName: string): number {
  return TASK_COST_EUR.find((entry) => entry.match.test(taskName))?.cost ?? DEFAULT_TASK_COST_EUR;
}

/**
 * Estimate the first-year scheduled-service cost from the OEM schedule. A task
 * contributes a fraction of its cost based on how much of its interval falls
 * within 12 months (a 24-month item counts ~half) and its priority weight.
 * Returns a whole EUR figure, or null when there is nothing to base it on.
 */
export function projectFirstYearCostEur(schedules: ReadonlyArray<OemSchedule>): number | null {
  if (schedules.length === 0) return null;

  let total = 0;
  for (const s of schedules) {
    const intervalDays = s.intervalDays ?? 365;
    // Fraction of this task expected within the first year (cap at 1 — a
    // 3-month item is done once in onboarding's planning horizon, not 4×).
    const yearFraction = Math.min(1, 365 / Math.max(intervalDays, 1));
    const weight = PRIORITY_WEIGHT[s.priority as GqlMaintenancePriority] ?? 0.8;
    total += costForTask(s.taskName) * yearFraction * weight;
  }

  const rounded = Math.round(total / 10) * 10; // nearest €10 — it's an estimate
  return rounded > 0 ? rounded : null;
}
