import type { MotorcycleRecallsQuery } from '@motovault/graphql';

export type RecallResultData = MotorcycleRecallsQuery['motorcycleRecalls'];
export type RecallItem = RecallResultData['recalls'][number];

/** Whether the rider is marking a recall as done or undoing that. */
export const RECALL_ACK_ACTION = {
  ACKNOWLEDGE: 'acknowledge',
  UNACKNOWLEDGE: 'unacknowledge',
} as const;
export type RecallAckAction = (typeof RECALL_ACK_ACTION)[keyof typeof RECALL_ACK_ACTION];

/** A recall still needs the rider's attention: NHTSA lists it and it is not marked as done. */
export function isOpenRecall(recall: { acknowledged?: boolean | null }): boolean {
  return !recall.acknowledged;
}

/** Open recalls in server order, and the ones marked as done, most recently marked first. */
export function splitRecalls<T extends Pick<RecallItem, 'acknowledged' | 'acknowledgedAt'>>(
  recalls: readonly T[],
): { open: T[]; done: T[] } {
  const open = recalls.filter(isOpenRecall);
  const done = recalls
    .filter((recall) => !isOpenRecall(recall))
    .sort((a, b) => (b.acknowledgedAt ?? '').localeCompare(a.acknowledgedAt ?? ''));
  return { open, done };
}

/**
 * The optimistic result of marking `campaignNumber` as done (or undoing it),
 * mirroring what the API returns: flags set, counts recomputed, open first.
 * A campaign not in the list leaves the result unchanged.
 */
export function applyRecallAcknowledgement(
  result: RecallResultData,
  campaignNumber: string,
  action: RecallAckAction,
  nowIso: string,
): RecallResultData {
  if (!result.recalls.some((recall) => recall.campaignNumber === campaignNumber)) return result;
  const acknowledged = action === RECALL_ACK_ACTION.ACKNOWLEDGE;
  const recalls = result.recalls.map((recall) => {
    if (recall.campaignNumber !== campaignNumber) return recall;
    // Re-acknowledging keeps the original date, as the server does.
    const acknowledgedAt = acknowledged ? (recall.acknowledgedAt ?? nowIso) : null;
    return { ...recall, acknowledged, acknowledgedAt };
  });
  const { open, done } = splitRecalls(recalls);
  return {
    ...result,
    count: open.length,
    acknowledgedCount: done.length,
    recalls: [...open, ...done],
  };
}
