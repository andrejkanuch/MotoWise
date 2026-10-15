import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  CreateTripWithWaypointsDocument,
  type CreateTripWithWaypointsInput,
  DeleteTripDocument,
  PublishAsTemplateDocument,
  PublishTripDocument,
  TripDetailDocument,
  UpdateTripDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { userFriendlyError } from '../lib/graphql-errors';
import { invalidateTrips } from '../lib/invalidate';
import { queryKeys } from '../lib/query-keys';
import { REVIEW_ACTION, recordReviewAction } from '../lib/store-review';
import { triggerNotification } from '../utils/haptics';

interface RouterLike {
  back: () => void;
  dismissAll: () => void;
}

/**
 * A public showcase becomes a discoverable template (publishAsTemplate sets
 * is_template + visibility=public + status=published); everything else uses the
 * standard publish (status draft -> published). The result payload is unused, so
 * the two documents are normalized to a single `{ tripId }` document type.
 */
function publishDocFor(
  input: CreateTripWithWaypointsInput,
): TypedDocumentNode<unknown, { tripId: string }> {
  const doc =
    input.isShowcase && input.visibility === 'public'
      ? PublishAsTemplateDocument
      : PublishTripDocument;
  return doc as TypedDocumentNode<unknown, { tripId: string }>;
}

interface UseCreateTripDataParams {
  sourceTripId: string | undefined;
  tripId: string | undefined;
  buildTripInput: () => CreateTripWithWaypointsInput;
  difficulty: string;
  waypointCount: number;
  maxRiders: string;
  router: RouterLike;
}

export function useCreateTripData({
  sourceTripId,
  tripId,
  buildTripInput,
  difficulty,
  waypointCount,
  maxRiders,
  router,
}: UseCreateTripDataParams) {
  const queryClient = useQueryClient();

  // The source trip in edit OR clone mode. The form copies the first data it
  // sees and ignores later data, so the editor must open with the trip as the
  // server has it now: `gcTime: 0` drops the entry when the editor closes, and
  // the next open has no data until the fetch returns — also after a change
  // made elsewhere, such as an accepted suggestion.
  const tripQuery = useQuery({
    queryKey: queryKeys.trips.edit(sourceTripId ?? ''),
    queryFn: () => gqlFetcher(TripDetailDocument, { tripId: sourceTripId ?? '' }),
    enabled: !!sourceTripId,
    gcTime: 0,
  });

  // Save draft mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const result = await gqlFetcher(CreateTripWithWaypointsDocument, {
        input: buildTripInput(),
      });
      return result.createTripWithWaypoints.id;
    },
    onSuccess: () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.TRIP_CREATED, {
        difficulty,
        waypoint_count: waypointCount,
        published: false,
      });
      invalidateTrips(queryClient);
      recordReviewAction(REVIEW_ACTION.EXPENSE_OR_TRIP);
      router.back();
    },
    onError: (error) => {
      Alert.alert('Failed to save trip', userFriendlyError(error));
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      const input = buildTripInput();
      const result = await gqlFetcher(CreateTripWithWaypointsDocument, { input });
      const newTripId = result.createTripWithWaypoints.id;
      await gqlFetcher(publishDocFor(input), { tripId: newTripId });
      return newTripId;
    },
    onSuccess: () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      // MOT-285: the publish path also CREATES a trip — fire TRIP_CREATED here too
      // so the trip_created -> trip_published funnel is computable (published trips
      // were previously invisible to the create step).
      trackEvent(AnalyticsEvent.TRIP_CREATED, {
        difficulty,
        waypoint_count: waypointCount,
        published: true,
      });
      trackEvent(AnalyticsEvent.TRIP_PUBLISHED, {
        difficulty,
        waypoint_count: waypointCount,
        max_riders: Number.parseInt(maxRiders, 10) || 10,
      });
      invalidateTrips(queryClient);
      recordReviewAction(REVIEW_ACTION.EXPENSE_OR_TRIP);
      router.back();
    },
    onError: (error) => {
      Alert.alert('Failed to publish trip', userFriendlyError(error));
    },
  });

  // Update mutation (edit mode) — includes waypoints
  const updateMutation = useMutation({
    mutationFn: async () => {
      // isShowcase/dayCount are create-only inputs — UpdateTripInput does not
      // define them, so strip them or the GraphQL request is rejected.
      const { isShowcase: _isShowcase, dayCount: _dayCount, ...updateInput } = buildTripInput();
      await gqlFetcher(UpdateTripDocument, {
        input: {
          tripId: tripId ?? '',
          ...updateInput,
        },
      });
    },
    onSuccess: async () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      await invalidateTrips(queryClient, tripId ?? '');
      router.back();
    },
    onError: (error) => {
      Alert.alert('Failed to update trip', userFriendlyError(error));
    },
  });

  // Update + publish mutation (edit mode, draft → published)
  const updateAndPublishMutation = useMutation({
    mutationFn: async () => {
      const tripInput = buildTripInput();
      const editTripId = tripId ?? '';
      const { isShowcase: _isShowcase, dayCount: _dayCount, ...updateInput } = tripInput;
      await gqlFetcher(UpdateTripDocument, {
        input: { tripId: editTripId, ...updateInput },
      });
      await gqlFetcher(publishDocFor(tripInput), { tripId: editTripId });
    },
    onSuccess: async () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      await invalidateTrips(queryClient, tripId ?? '');
      router.back();
    },
    onError: (error) => {
      Alert.alert('Failed to publish trip', userFriendlyError(error));
    },
  });

  // Delete mutation (edit mode only) — permanently removes the trip.
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await gqlFetcher(DeleteTripDocument, { tripId: tripId ?? '' });
    },
    onSuccess: () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      invalidateTrips(queryClient);
      queryClient.removeQueries({ queryKey: queryKeys.trips.detail(tripId ?? '') });
      // Pop both the edit modal AND the trip-detail modal underneath it.
      router.dismissAll();
    },
    onError: (error) => {
      Alert.alert('Failed to delete trip', userFriendlyError(error));
    },
  });

  return {
    tripQuery,
    saveMutation,
    publishMutation,
    updateMutation,
    updateAndPublishMutation,
    deleteMutation,
  };
}
