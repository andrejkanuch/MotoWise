import {
  CreateTripWithWaypointsDocument,
  type CreateTripWithWaypointsInput,
  DeleteTripDocument,
  PublishTripDocument,
  TripDetailDocument,
  UpdateTripDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { AnalyticsEvent, trackEvent, trackEventWithSurvey } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { userFriendlyError } from '../lib/graphql-errors';
import { queryKeys } from '../lib/query-keys';
import { maybeRequestReview } from '../lib/store-review';

interface RouterLike {
  back: () => void;
  dismissAll: () => void;
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

  // Fetch existing trip data when in edit OR clone mode
  const tripQuery = useQuery({
    queryKey: ['trip-edit', sourceTripId],
    queryFn: () => gqlFetcher(TripDetailDocument, { tripId: sourceTripId ?? '' }),
    enabled: !!sourceTripId,
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
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEventWithSurvey(AnalyticsEvent.TRIP_CREATED, {
        difficulty,
        waypoint_count: waypointCount,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      maybeRequestReview();
      router.back();
    },
    onError: (error) => {
      Alert.alert('Failed to save trip', userFriendlyError(error));
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      const result = await gqlFetcher(CreateTripWithWaypointsDocument, {
        input: buildTripInput(),
      });
      const newTripId = result.createTripWithWaypoints.id;
      await gqlFetcher(PublishTripDocument, { tripId: newTripId });
      return newTripId;
    },
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.TRIP_PUBLISHED, {
        difficulty,
        waypoint_count: waypointCount,
        max_riders: Number.parseInt(maxRiders, 10) || 10,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      maybeRequestReview();
      router.back();
    },
    onError: (error) => {
      Alert.alert('Failed to publish trip', userFriendlyError(error));
    },
  });

  // Update mutation (edit mode) — includes waypoints
  const updateMutation = useMutation({
    mutationFn: async () => {
      const tripInput = buildTripInput();
      await gqlFetcher(UpdateTripDocument, {
        input: {
          tripId: tripId ?? '',
          ...tripInput,
        },
      });
    },
    onSuccess: async () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.trips.detail(tripId ?? ''),
      });
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
      await gqlFetcher(UpdateTripDocument, {
        input: { tripId: editTripId, ...tripInput },
      });
      await gqlFetcher(PublishTripDocument, { tripId: editTripId });
    },
    onSuccess: async () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.trips.detail(tripId ?? ''),
      });
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
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
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
