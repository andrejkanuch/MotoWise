import type { MotorcycleRecallsQuery } from '@motovault/graphql';
import { RECALL_CRITICAL_KEYWORDS, RECALL_SEVERITY, type RecallSeverity } from './constants';
import { isOpenRecall, type OpenRecallInput } from './recall-acknowledgement';

type Recall = MotorcycleRecallsQuery['motorcycleRecalls']['recalls'][number];

export type RecallSeverityInput = Pick<Recall, 'component' | 'summary' | 'consequence'>;

/**
 * Critical when the recall's component, summary or consequence mentions a stall,
 * brakes, steering, fuel or fire (case-insensitive substring), else High.
 */
export function getRecallSeverity(recall: RecallSeverityInput): RecallSeverity {
  const text = `${recall.component} ${recall.summary} ${recall.consequence}`.toLowerCase();
  const critical = RECALL_CRITICAL_KEYWORDS.some((keyword) => text.includes(keyword));
  return critical ? RECALL_SEVERITY.CRITICAL : RECALL_SEVERITY.HIGH;
}

/**
 * Open recalls for the bike: every recall NHTSA returns that the rider has not
 * marked as done (`acknowledged`). While the recalls query is loading or has
 * failed, the count persisted on the bike (`recallCount`, which the API also
 * stores as the open count) stands in.
 */
export function countOpenRecalls(
  recalls: readonly OpenRecallInput[] | null | undefined,
  fallbackCount: number | null | undefined,
): number {
  if (recalls) return recalls.filter(isOpenRecall).length;
  return fallbackCount ?? 0;
}
