import {
  AcknowledgeRecallDocument,
  type MotorcycleRecallsQuery,
  type MyMotorcyclesQuery,
  UnacknowledgeRecallDocument,
} from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationFeedbackType } from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
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
import { triggerNotification } from '../utils/haptics';

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

/** Every ack/undo for one bike shares this key (pending count) and scope (serial). */
export function recallAckMutationKey(motorcycleId: string) {
  return ['recall-ack', motorcycleId] as const;
}

/**
 * Marks a recall as done (or undoes it) with an optimistic update of the recall
 * list and the bike's `recallCount`.
 *
 * Acks for one bike run one at a time (`scope`): every tap applies its
 * optimistic change at once, but the requests go out in order, so the last
 * server result reflects every ack before it. While another ack for the bike is
 * still pending, a result is not written over the cache (it would hide the
 * pending optimistic change) and an error does not restore this mutation's
 * snapshot (it would undo the other one); the last ack to settle writes its
 * result, and then both caches are refetched so every reader agrees.
 *
 * The error alert lives here, not in the caller, so it still shows when the
 * recalls sheet unmounted before the request failed.
 */
export function useRecallAcknowledgement(motorcycleId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const recallsKey = queryKeys.motorcycleRecalls.byMotorcycle(motorcycleId);
  const bikesKey = queryKeys.motorcycles.all;
  const mutationKey = recallAckMutationKey(motorcycleId);
  /** Inside a callback the settling mutation itself is still pending, so "alone" is 1. */
  const othersPending = () => queryClient.isMutating({ mutationKey }) > 1;

  return useMutation({
    mutationKey,
    scope: { id: `recall-ack-${motorcycleId}` },
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
      triggerNotification(NotificationFeedbackType.Error);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('recalls.ackError', {
          defaultValue: "Couldn't update this recall. Please try again.",
        }),
      );
      // Another ack already applied on top of this snapshot: restoring it would
      // undo that one. The refetch once the last ack settles corrects both.
      if (!context || othersPending()) return;
      queryClient.setQueryData(recallsKey, context.previousRecalls);
      queryClient.setQueryData(bikesKey, context.previousBikes);
    },
    onSuccess: (result, { campaignNumber, action }) => {
      trackEvent(EVENT[action], { campaign_number: campaignNumber, motorcycle_id: motorcycleId });
      // Requests run in order, so the last result includes every earlier ack;
      // an earlier one would hide the optimistic change still in flight.
      if (othersPending()) return;
      queryClient.setQueryData<MotorcycleRecallsQuery>(recallsKey, { motorcycleRecalls: result });
      queryClient.setQueryData<MyMotorcyclesQuery>(bikesKey, (current) =>
        withRecallCount(current, motorcycleId, result.count),
      );
    },
    onSettled: () => {
      if (othersPending()) return;
      // The server persisted the new recall_count and acknowledgement rows;
      // refetch so every reader of the garage list (plate, garage badge, hub
      // attention, CarPlay) and the recall list itself agree with it.
      queryClient.invalidateQueries({ queryKey: recallsKey });
      queryClient.invalidateQueries({ queryKey: bikesKey });
    },
  });
}
