import {
  AcknowledgeRecallDocument,
  type MotorcycleRecallsQuery,
  type MyMotorcyclesQuery,
  UnacknowledgeRecallDocument,
} from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import {
  applyRecallAcknowledgement,
  RECALL_ACK_ACTION,
  type RecallAckAction,
  type RecallResultData,
} from '../lib/bike-hub/recall-acknowledgement';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import { QUERY_META } from '../lib/query-meta';

export interface RecallAckVariables {
  campaignNumber: string;
  action: RecallAckAction;
}

/** One mutation per action; both return the fresh RecallResult. */
const SEND = {
  [RECALL_ACK_ACTION.ACKNOWLEDGE]: async (motorcycleId: string, campaignNumber: string) =>
    (await gqlFetcher(AcknowledgeRecallDocument, { motorcycleId, campaignNumber }))
      .acknowledgeRecall,
  [RECALL_ACK_ACTION.UNACKNOWLEDGE]: async (motorcycleId: string, campaignNumber: string) =>
    (await gqlFetcher(UnacknowledgeRecallDocument, { motorcycleId, campaignNumber }))
      .unacknowledgeRecall,
} as const satisfies Record<
  RecallAckAction,
  (motorcycleId: string, campaignNumber: string) => Promise<RecallResultData>
>;

const EVENT = {
  [RECALL_ACK_ACTION.ACKNOWLEDGE]: AnalyticsEvent.RECALL_ACKNOWLEDGED,
  [RECALL_ACK_ACTION.UNACKNOWLEDGE]: AnalyticsEvent.RECALL_UNACKNOWLEDGED,
} as const;

/** The bike's `recallCount` in the garage list cache — what the plate, badge and CarPlay read. */
function withRecallCount(
  data: MyMotorcyclesQuery | undefined,
  motorcycleId: string,
  recallCount: number,
): MyMotorcyclesQuery | undefined {
  if (!data) return data;
  return {
    myMotorcycles: data.myMotorcycles.map((bike) =>
      bike.id === motorcycleId ? { ...bike, recallCount } : bike,
    ),
  };
}

/**
 * Marks a recall as done (or undoes it) with an optimistic update of the recall
 * list and the bike's `recallCount`, rolled back on error. The caller shows its
 * own error alert (`onError` passed to `mutate`), so the global alert stays out.
 */
export function useRecallAcknowledgement(motorcycleId: string) {
  const queryClient = useQueryClient();
  const recallsKey = queryKeys.motorcycleRecalls.byMotorcycle(motorcycleId);
  const bikesKey = queryKeys.motorcycles.all;

  return useMutation({
    meta: QUERY_META.OWN_ERROR_UI,
    mutationFn: ({ campaignNumber, action }: RecallAckVariables) =>
      SEND[action](motorcycleId, campaignNumber),
    onMutate: async ({ campaignNumber, action }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: recallsKey }),
        queryClient.cancelQueries({ queryKey: bikesKey }),
      ]);
      const previousRecalls = queryClient.getQueryData<MotorcycleRecallsQuery>(recallsKey);
      const previousBikes = queryClient.getQueryData<MyMotorcyclesQuery>(bikesKey);
      if (previousRecalls) {
        const next = applyRecallAcknowledgement(
          previousRecalls.motorcycleRecalls,
          campaignNumber,
          action,
          new Date().toISOString(),
        );
        queryClient.setQueryData<MotorcycleRecallsQuery>(recallsKey, { motorcycleRecalls: next });
        queryClient.setQueryData<MyMotorcyclesQuery>(bikesKey, (current) =>
          withRecallCount(current, motorcycleId, next.count),
        );
      }
      return { previousRecalls, previousBikes };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(recallsKey, context.previousRecalls);
      queryClient.setQueryData(bikesKey, context.previousBikes);
    },
    onSuccess: (result, { campaignNumber, action }) => {
      queryClient.setQueryData<MotorcycleRecallsQuery>(recallsKey, { motorcycleRecalls: result });
      queryClient.setQueryData<MyMotorcyclesQuery>(bikesKey, (current) =>
        withRecallCount(current, motorcycleId, result.count),
      );
      trackEvent(EVENT[action], { campaign_number: campaignNumber, motorcycle_id: motorcycleId });
    },
    onSettled: () => {
      // The server persisted the new recall_count; refetch so every reader of
      // the garage list (plate, garage badge, hub attention, CarPlay) agrees.
      queryClient.invalidateQueries({ queryKey: bikesKey });
    },
  });
}
