import { MaintenancePriority, type MaintenanceTasksByMotorcycleQuery } from '@motovault/graphql';
import {
  DUE_STATE,
  type HubUnit,
  RIDE_STATUS,
  RIDE_STATUS_REASON,
  type RideStatus,
} from './constants';
import { getDocumentSignals, type HubCategoryInput, type HubDocumentInput } from './documents';
import { countOpenRecalls, type OpenRecallInput } from './recall-severity';
import { getTaskDue, isActiveTask } from './task-due';

type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];

export type RideStatusTaskInput = Pick<
  Task,
  'id' | 'priority' | 'status' | 'dueDate' | 'targetMileage' | 'source'
>;

export type RideStatusReason =
  | { kind: typeof RIDE_STATUS_REASON.OVERDUE_CRITICAL; count: number }
  | { kind: typeof RIDE_STATUS_REASON.OVERDUE_HIGH; count: number }
  | { kind: typeof RIDE_STATUS_REASON.OPEN_RECALLS; count: number }
  | { kind: typeof RIDE_STATUS_REASON.DOCUMENT_EXPIRED; categoryName: string; days: number }
  | { kind: typeof RIDE_STATUS_REASON.DOCUMENT_EXPIRING; categoryName: string; days: number };

export interface RideStatusInput {
  /** Every task of the bike, completed ones included (they count as "tracked"). */
  tasks: readonly RideStatusTaskInput[];
  documents: readonly HubDocumentInput[];
  categories: readonly HubCategoryInput[];
  /** Recalls returned for the bike; `null` while unknown (loading / failed). */
  recalls: readonly OpenRecallInput[] | null;
  /** `bike.recallCount` — used when `recalls` is `null`. */
  recallCount?: number | null;
  odometer: number | null | undefined;
  today: Date;
  unit: HubUnit;
}

export interface RideStatusResult {
  status: RideStatus;
  /** What put the bike in this status, most serious first. Empty for READY / UNTRACKED. */
  reasons: RideStatusReason[];
}

/**
 * Spec §2 ride status. NOT_READY: an overdue Critical task or an expired
 * document in a riding-blocking category. CHECK: an open recall, an overdue
 * High task, or a blocking document expiring within 30 days. UNTRACKED: no
 * tasks, no documents, no recalls. Overdue Low / Medium never change it.
 */
export function getRideStatus(input: RideStatusInput): RideStatusResult {
  const { tasks, documents, categories, recalls, recallCount, odometer, today, unit } = input;

  const overdue = tasks.filter(
    (task) =>
      isActiveTask(task) && getTaskDue(task, { odometer, today, unit }).state === DUE_STATE.OVERDUE,
  );
  const overdueCritical = overdue.filter((t) => t.priority === MaintenancePriority.Critical).length;
  const overdueHigh = overdue.filter((t) => t.priority === MaintenancePriority.High).length;

  const blocking = getDocumentSignals(documents, categories, today).filter((s) => s.blocksRiding);
  const expired = blocking.filter((signal) => signal.expired);
  const expiring = blocking.filter((signal) => !signal.expired);
  const openRecalls = countOpenRecalls(recalls, recallCount);

  const notReadyReasons: RideStatusReason[] = [
    ...(overdueCritical > 0
      ? [{ kind: RIDE_STATUS_REASON.OVERDUE_CRITICAL, count: overdueCritical }]
      : []),
    ...expired.map((signal) => ({
      kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRED,
      categoryName: signal.categoryName ?? '',
      days: signal.days,
    })),
  ];
  const checkReasons: RideStatusReason[] = [
    ...(openRecalls > 0 ? [{ kind: RIDE_STATUS_REASON.OPEN_RECALLS, count: openRecalls }] : []),
    ...(overdueHigh > 0 ? [{ kind: RIDE_STATUS_REASON.OVERDUE_HIGH, count: overdueHigh }] : []),
    ...expiring.map((signal) => ({
      kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRING,
      categoryName: signal.categoryName ?? '',
      days: signal.days,
    })),
  ];

  if (notReadyReasons.length > 0) {
    return { status: RIDE_STATUS.NOT_READY, reasons: [...notReadyReasons, ...checkReasons] };
  }
  if (checkReasons.length > 0) {
    return { status: RIDE_STATUS.CHECK, reasons: checkReasons };
  }
  const nothingTracked = tasks.length === 0 && documents.length === 0 && openRecalls === 0;
  return { status: nothingTracked ? RIDE_STATUS.UNTRACKED : RIDE_STATUS.READY, reasons: [] };
}
