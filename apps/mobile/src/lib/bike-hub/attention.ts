import {
  MaintenancePriority,
  type MaintenanceTasksByMotorcycleQuery,
  type MotorcycleRecallsQuery,
} from '@motovault/graphql';
import { ATTENTION_KIND, ATTENTION_MAX_ROWS, DUE_STATE, RECALL_SEVERITY } from './constants';
import {
  type DocumentSignal,
  getDocumentSignals,
  type HubCategoryInput,
  type HubDocumentInput,
} from './documents';
import { recallComponentLabels } from './recall-label';
import { countOpenRecalls, getRecallSeverity } from './recall-severity';
import {
  comparePriority,
  compareTasksForAttention,
  type DueContext,
  dueUrgency,
  getTaskDue,
  isActiveTask,
  type TaskDue,
} from './task-due';

type Task = MaintenanceTasksByMotorcycleQuery['maintenanceTasks'][number];
type Recall = MotorcycleRecallsQuery['motorcycleRecalls']['recalls'][number];

export type AttentionTaskInput = Pick<
  Task,
  'id' | 'title' | 'priority' | 'status' | 'dueDate' | 'targetMileage' | 'source'
>;
export type AttentionRecallInput = Pick<
  Recall,
  'campaignNumber' | 'component' | 'summary' | 'consequence'
>;

/** All open recalls, grouped into one row. */
export interface RecallAttentionItem {
  kind: typeof ATTENTION_KIND.RECALL;
  id: string;
  count: number;
  /**
   * The recalls' components as a rider reads them (`recallComponentLabel`:
   * most specific level, sentence case, repeats dropped); empty while the
   * recall detail is unknown.
   */
  components: string[];
  /** True when any recall is Critical. Unknown detail is treated as not critical. */
  critical: boolean;
}

export interface TaskAttentionItem {
  kind: typeof ATTENTION_KIND.TASK;
  id: string;
  task: AttentionTaskInput;
  due: TaskDue;
}

export interface DocumentAttentionItem {
  kind: typeof ATTENTION_KIND.DOCUMENT;
  id: string;
  signal: DocumentSignal;
}

export type AttentionItem = RecallAttentionItem | TaskAttentionItem | DocumentAttentionItem;

export interface AttentionOverflow {
  count: number;
  /** Titles of the folded rows, in rank order. */
  titles: string[];
  /** True when every folded row is an overdue task ("3 more overdue, …"). */
  allOverdue: boolean;
  /** Distinct priorities of the folded tasks, highest first. */
  priorities: MaintenancePriority[];
}

export interface AttentionResult {
  items: AttentionItem[];
  total: number;
  visible: AttentionItem[];
  overflow: AttentionOverflow | null;
}

export interface AttentionInput extends DueContext {
  tasks: readonly AttentionTaskInput[];
  documents: readonly HubDocumentInput[];
  categories: readonly HubCategoryInput[];
  /** Recalls returned for the bike; `null` while unknown (loading / failed). */
  recalls: readonly AttentionRecallInput[] | null;
  /** `bike.recallCount` — used when `recalls` is `null`. */
  recallCount?: number | null;
  /** Tasks shown elsewhere on the page (the Overview passes the Next-up task). */
  excludeTaskIds?: readonly string[];
}

const RECALL_ITEM_ID = 'recalls';
const URGENT_PRIORITIES: readonly MaintenancePriority[] = [
  MaintenancePriority.Critical,
  MaintenancePriority.High,
];

function isUrgent(task: Pick<Task, 'priority'>): boolean {
  return URGENT_PRIORITIES.includes(task.priority);
}

function recallItem(
  recalls: readonly AttentionRecallInput[] | null,
  recallCount: number | null | undefined,
): RecallAttentionItem[] {
  const count = countOpenRecalls(recalls, recallCount);
  if (count === 0) return [];
  const known = recalls ?? [];
  return [
    {
      kind: ATTENTION_KIND.RECALL,
      id: RECALL_ITEM_ID,
      count,
      components: recallComponentLabels(known.map((recall) => recall.component)),
      critical: known.some((recall) => getRecallSeverity(recall) === RECALL_SEVERITY.CRITICAL),
    },
  ];
}

function rankedTasks(
  tasks: readonly AttentionTaskInput[],
  context: DueContext,
): TaskAttentionItem[] {
  return tasks.filter(isActiveTask).map((task) => ({
    kind: ATTENTION_KIND.TASK,
    id: task.id,
    task,
    due: getTaskDue(task, context),
  }));
}

function buildOverflow(folded: readonly AttentionItem[]): AttentionOverflow | null {
  if (folded.length === 0) return null;
  const tasks = folded.filter(
    (item): item is TaskAttentionItem => item.kind === ATTENTION_KIND.TASK,
  );
  const titleOf = (item: AttentionItem): string[] => {
    if (item.kind === ATTENTION_KIND.TASK) return [item.task.title];
    if (item.kind === ATTENTION_KIND.DOCUMENT) return [item.signal.document.title];
    return item.components;
  };
  return {
    count: folded.length,
    titles: folded.flatMap(titleOf),
    allOverdue:
      tasks.length === folded.length && tasks.every((item) => item.due.state === DUE_STATE.OVERDUE),
    priorities: [...new Set(tasks.map((item) => item.task.priority))].sort(comparePriority),
  };
}

/**
 * Spec §2 "Needs attention" ranking: recalls (one grouped row) → overdue
 * Critical / High → expired or expiring documents → other overdue → due soon.
 * The first `ATTENTION_MAX_ROWS` are shown; the rest fold into one overflow row.
 */
export function rankAttention(input: AttentionInput): AttentionResult {
  const { tasks, documents, categories, recalls, recallCount, excludeTaskIds = [] } = input;
  const context: DueContext = { odometer: input.odometer, today: input.today, unit: input.unit };
  const byRank = (a: TaskAttentionItem, b: TaskAttentionItem): number =>
    compareTasksForAttention(a, b, input.unit);

  const candidates = rankedTasks(tasks, context).filter(
    (item) => !excludeTaskIds.includes(item.id),
  );
  const overdue = candidates.filter((item) => item.due.state === DUE_STATE.OVERDUE);
  const soon = candidates.filter((item) => item.due.state === DUE_STATE.SOON);

  const documentItems: DocumentAttentionItem[] = getDocumentSignals(
    documents,
    categories,
    input.today,
  ).map((signal) => ({ kind: ATTENTION_KIND.DOCUMENT, id: signal.document.id, signal }));

  const items: AttentionItem[] = [
    ...recallItem(recalls, recallCount),
    ...overdue.filter((item) => isUrgent(item.task)).sort(byRank),
    ...documentItems,
    ...overdue.filter((item) => !isUrgent(item.task)).sort(byRank),
    ...soon.sort(byRank),
  ];

  return {
    items,
    total: items.length,
    visible: items.slice(0, ATTENTION_MAX_ROWS),
    overflow: buildOverflow(items.slice(ATTENTION_MAX_ROWS)),
  };
}

/** The nearest active task that is not overdue and has a date or a target. */
export function getNextUp<T extends AttentionTaskInput>(
  tasks: readonly T[],
  context: DueContext,
): { task: T; due: TaskDue } | null {
  const upcoming = tasks
    .filter(isActiveTask)
    .map((task) => ({ task, due: getTaskDue(task, context) }))
    .filter(({ due }) => due.state === DUE_STATE.SOON || due.state === DUE_STATE.LATER)
    .sort((a, b) => dueUrgency(a.due, context.unit) - dueUrgency(b.due, context.unit));
  return upcoming[0] ?? null;
}

/**
 * THE HUB'S ONE COUNT — "overdue tasks".
 *
 * Every number the bike hub shows for "what the rider has to act on" uses this
 * basis, so the three places that show it always agree:
 *  - the Service segment badge (`getServiceBadgeCount`),
 *  - the Service segment's "Overdue · N" group eyebrow (the same rows, listed),
 *  - Overview "Needs attention · N overdue" (`countOverdueAttentionItems`).
 *
 * Basis: active (pending / in progress) tasks whose `getTaskDue` state is
 * OVERDUE — the date has passed OR the odometer has reached the target — of
 * ANY priority. Priority is shown by each row's tag, never folded into the
 * count. Recalls, documents and due-soon tasks can still appear as rows in
 * Needs attention, but are never counted in this number.
 *
 * (Until 2026-10 the badge counted overdue Critical / High only, while Service
 * showed every overdue task and Needs attention counted all of its rows —
 * three numbers for one screen: 1 / 5 / 6 on the test bike.)
 */
export function countOverdueTasks(
  tasks: readonly Pick<Task, 'status' | 'dueDate' | 'targetMileage' | 'source'>[],
  context: DueContext,
): number {
  return tasks.filter(
    (task) => isActiveTask(task) && getTaskDue(task, context).state === DUE_STATE.OVERDUE,
  ).length;
}

/** Service segment badge — see `countOverdueTasks` for the basis. */
export function getServiceBadgeCount(
  tasks: readonly Pick<Task, 'priority' | 'status' | 'dueDate' | 'targetMileage' | 'source'>[],
  context: DueContext,
): number {
  return countOverdueTasks(tasks, context);
}

/**
 * The overdue tasks among ranked attention rows — equal to `countOverdueTasks`
 * for the same tasks (`rankAttention` keeps every overdue task; only the
 * not-overdue Next-up task is ever excluded).
 */
export function countOverdueAttentionItems(items: readonly AttentionItem[]): number {
  return items.filter(
    (item) => item.kind === ATTENTION_KIND.TASK && item.due.state === DUE_STATE.OVERDUE,
  ).length;
}
