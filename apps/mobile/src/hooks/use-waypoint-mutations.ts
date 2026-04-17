/**
 * #133 — shared waypoint mutations hook.
 *
 * Both the organiser's direct editing (trip-detail) and the co-planner's
 * suggestion-accept flow end up mutating trip_waypoints. This hook
 * centralises add / update / remove so both paths share the same cache
 * invalidation and optimistic patterns.
 */
import {
  AddWaypointDocument,
  type AddWaypointMutation,
  type CreateWaypointInput,
  RemoveWaypointDocument,
  type RemoveWaypointMutation,
  UpdateWaypointDocument,
  type UpdateWaypointInput,
  type UpdateWaypointMutation,
} from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

export function useWaypointMutations(tripId: string | undefined) {
  const qc = useQueryClient();
  const resolvedTripId = tripId ?? '';

  const invalidate = useCallback(() => {
    if (!resolvedTripId) return;
    qc.invalidateQueries({ queryKey: queryKeys.trips.detail(resolvedTripId) });
  }, [qc, resolvedTripId]);

  const add = useMutation<AddWaypointMutation, Error, CreateWaypointInput>({
    mutationFn: (input) => gqlFetcher(AddWaypointDocument, { input }),
    onSuccess: invalidate,
  });

  const update = useMutation<UpdateWaypointMutation, Error, UpdateWaypointInput>({
    mutationFn: (input) => gqlFetcher(UpdateWaypointDocument, { input }),
    onSuccess: invalidate,
  });

  const remove = useMutation<RemoveWaypointMutation, Error, string>({
    mutationFn: (waypointId) => gqlFetcher(RemoveWaypointDocument, { waypointId }),
    onSuccess: invalidate,
  });

  return {
    addWaypoint: add.mutateAsync,
    updateWaypoint: update.mutateAsync,
    removeWaypoint: remove.mutateAsync,
    isAdding: add.isPending,
    isUpdating: update.isPending,
    isRemoving: remove.isPending,
  };
}
