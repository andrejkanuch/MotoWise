import { MaintenancePriority, MaintenanceTaskStatus } from '@motovault/graphql';
import { DUE_STATE, DUE_TONE, type DueState, type DueTone } from '../../../lib/bike-hub/constants';
import {
  compareTasksForAttention,
  type DueContext,
  getTaskDue,
  isActiveTask,
  type TaskDue,
} from '../../../lib/bike-hub/task-due';
import type { HubTask } from '../shell/use-bike-hub-data';
import type { HubCopyKey } from '../ui/tokens';

export interface ServiceTaskItem {
  task: HubTask;
  due: TaskDue;
}

export interface ServiceGroup {
  state: DueState;
  labelKey: HubCopyKey;
  /** Colours the eyebrow: Overdue in the late colour, Due soon in amber. */
  tone?: DueTone;
  items: ServiceTaskItem[];
}

/** Group order and copy (spec §2: Overdue / Due soon / Later / Someday). */
const GROUPS: readonly { state: DueState; labelKey: HubCopyKey; tone?: DueTone }[] = [
  { state: DUE_STATE.OVERDUE, labelKey: 'bikeHub.service.group.overdue', tone: DUE_TONE.LATE },
  { state: DUE_STATE.SOON, labelKey: 'bikeHub.service.group.soon', tone: DUE_TONE.SOON },
  { state: DUE_STATE.LATER, labelKey: 'bikeHub.service.group.later' },
  { state: DUE_STATE.SOMEDAY, labelKey: 'bikeHub.service.group.someday' },
];

/**
 * Active tasks in their due groups, each sorted priority first, then nearest
 * due. Empty groups are dropped. The Overdue group's length is the hub's one
 * count (`countOverdueTasks`): the same tasks, by the same `getTaskDue` rule.
 */
export function groupActiveTasks(tasks: readonly HubTask[], context: DueContext): ServiceGroup[] {
  const items = tasks
    .filter(isActiveTask)
    .map((task) => ({ task, due: getTaskDue(task, context) }))
    .sort((a, b) => compareTasksForAttention(a, b, context.unit));
  return GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.due.state === group.state),
  })).filter((group) => group.items.length > 0);
}

/** An overdue Critical task — the only row that gets the tinted critical surface. */
export function isCriticalOverdue(item: ServiceTaskItem): boolean {
  return (
    item.task.priority === MaintenancePriority.Critical && item.due.state === DUE_STATE.OVERDUE
  );
}

function completedTime(task: HubTask): number {
  return task.completedAt ? new Date(task.completedAt).getTime() : 0;
}

/** Completed tasks, newest first. */
export function completedTasks(tasks: readonly HubTask[]): HubTask[] {
  return tasks
    .filter((task) => task.status === MaintenanceTaskStatus.Completed)
    .sort((a, b) => completedTime(b) - completedTime(a));
}

/**
 * Money paid for a completed task: the authoritative gross `totalAmount`
 * (receipt-scan financial wrapper) when present, else the additive cost +
 * parts + labor breakdown — mirrors the API's effectiveTaskTotal.
 */
export function effectiveTaskTotal(
  task: Pick<HubTask, 'totalAmount' | 'cost' | 'partsCost' | 'laborCost'>,
): number {
  if (task.totalAmount != null) return task.totalAmount;
  return (task.cost ?? 0) + (task.partsCost ?? 0) + (task.laborCost ?? 0);
}
