import {
  CloneTripDocument,
  CreateTripReviewDocument,
  JoinTripDocument,
  LeaveTripDocument,
  SaveTripDocument,
  TripDetailDocument,
  type TripDetailQuery,
  TripReviewsDocument,
  UnsaveTripDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { userFriendlyError } from '../lib/graphql-errors';
import { cacheTripPayload, getOfflineMeta, readCachedTripPayload } from '../lib/offline-trips';
import { queryKeys } from '../lib/query-keys';

/**
 * Data layer for the trip-detail screen — owns the TripDetail + reviews
 * queries, the join/leave/clone/save/unsave/createReview mutations, offline
 * payload caching, and the cache invalidations that tie them together. The
 * screen consumes the returned object and stays focused on presentation.
 */
export function useTripDetailData(
  tripId: string,
  options: {
    /** Live trip when an offline pack is ready — used to refresh the cache. */
    offlineReady?: boolean;
  } = {},
) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    queryFn: () => gqlFetcher(TripDetailDocument, { tripId }),
    enabled: !!tripId,
    meta: { showErrorAlert: false },
  });

  const offlineMeta = tripId ? getOfflineMeta(tripId) : null;
  const cachedPayload = useMemo(() => {
    if (data?.tripDetail != null || !tripId || !offlineMeta) return null;
    return readCachedTripPayload<TripDetailQuery>(tripId);
  }, [data?.tripDetail, tripId, offlineMeta]);

  const hasServerData = data?.tripDetail != null;
  const trip = data?.tripDetail ?? cachedPayload?.tripDetail ?? null;
  const isOfflineCopy = !hasServerData && !!cachedPayload;

  const isTemplate = trip?.isTemplate === true;

  // Whenever we have a live trip payload AND the user has an offline pack,
  // refresh the cached copy so trip-detail hydrates with fresh data next
  // time they open it without signal.
  const offlineReady = options.offlineReady ?? false;
  useEffect(() => {
    if (!trip || !tripId) return;
    if (offlineReady) {
      cacheTripPayload(tripId, trip);
    }
  }, [trip, tripId, offlineReady]);

  const invalidateTrip = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
  }, [queryClient, tripId]);

  const [actionLoading, setActionLoading] = useState(false);

  const joinMutation = useMutation({
    mutationFn: (status: string) => gqlFetcher(JoinTripDocument, { input: { tripId, status } }),
    onMutate: () => setActionLoading(true),
    onSettled: () => setActionLoading(false),
    onSuccess: (_data, status) => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.TRIP_JOINED, { trip_id: tripId, status });
      invalidateTrip();
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => gqlFetcher(LeaveTripDocument, { tripId }),
    onMutate: () => setActionLoading(true),
    onSettled: () => setActionLoading(false),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      trackEvent(AnalyticsEvent.TRIP_LEFT, { trip_id: tripId });
      invalidateTrip();
    },
  });

  const handleLeave = useCallback(() => {
    Alert.alert('Leave this trip?', "You'll drop off the rider list and lose your spot.", [
      { text: 'Stay in', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
    ]);
  }, [leaveMutation]);

  // ── Template-specific state & mutations ──────────────────────────────
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    if (trip) setIsSaved(!!trip.isSaved);
  }, [trip]);

  // Clone template mutation
  const cloneMutation = useMutation({
    mutationFn: () => gqlFetcher(CloneTripDocument, { tripId }),
    onSuccess: (data) => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      // Navigate to the cloned trip so the user can see it immediately
      const clonedId = data?.cloneTrip;
      if (clonedId) {
        router.dismiss();
        router.push({ pathname: '/(modals)/trip-detail', params: { tripId: clonedId } });
      }
    },
    onError: (err: Error) => {
      if (err.message?.includes('already cloned')) {
        Alert.alert('Already Cloned', 'You have already cloned this trip.');
      } else {
        Alert.alert('Clone Failed', userFriendlyError(err));
      }
    },
  });

  const handleCloneTemplate = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cloneMutation.mutate();
  }, [cloneMutation]);

  // Save / unsave mutations
  const saveMutation = useMutation({
    mutationFn: () => gqlFetcher(SaveTripDocument, { tripId }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSaved(true);
      invalidateTrip();
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: () => gqlFetcher(UnsaveTripDocument, { tripId }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsSaved(false);
      invalidateTrip();
    },
  });

  const handleToggleSave = useCallback(() => {
    if (isSaved) {
      unsaveMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  }, [isSaved, saveMutation, unsaveMutation]);

  // Reviews query for template
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: queryKeys.tripReviews.byTrip(tripId),
    queryFn: () => gqlFetcher(TripReviewsDocument, { tripId, first: 10 }),
    enabled: !!tripId && isTemplate,
  });

  const reviews = reviewsData?.tripReviews ?? [];

  // Write review state
  const [reviewFormVisible, setReviewFormVisible] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const createReviewMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateTripReviewDocument, {
        input: { tripId, rating: reviewRating, text: reviewText || undefined },
      }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReviewFormVisible(false);
      setReviewText('');
      setReviewRating(5);
      queryClient.invalidateQueries({
        queryKey: queryKeys.tripReviews.byTrip(tripId),
      });
      invalidateTrip();
    },
    onError: (err: Error) => {
      Alert.alert('Review Failed', userFriendlyError(err));
    },
  });

  const handleSubmitReview = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createReviewMutation.mutate();
  }, [createReviewMutation]);

  return {
    // Trip data
    trip,
    isLoading,
    isOfflineCopy,
    offlineMeta,
    // Join / leave
    actionLoading,
    joinMutation,
    handleLeave,
    // Clone / save / unsave
    isSaved,
    cloneMutation,
    handleCloneTemplate,
    saveMutation,
    unsaveMutation,
    handleToggleSave,
    // Reviews
    reviews,
    reviewsLoading,
    reviewFormVisible,
    setReviewFormVisible,
    reviewRating,
    setReviewRating,
    reviewText,
    setReviewText,
    createReviewMutation,
    handleSubmitReview,
  };
}
