/**
 * P5.1 — client hook for trip suggestions.
 */
import {
  CreateTripSuggestionDocument,
  type CreateTripSuggestionMutation,
  PeriodOfDay,
  RespondToTripSuggestionDocument,
  type RespondToTripSuggestionMutation,
  TripSuggestionDecision,
  TripSuggestionKind,
  TripSuggestionsDocument,
  type TripSuggestionsQuery,
  type TripSuggestionsQueryVariables,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

export type TripSuggestion = TripSuggestionsQuery['tripSuggestions'][number];
export type TripSuggestionAuthor = TripSuggestion['author'];

// Caller-facing input shapes use plain string unions so callers aren't forced
// to import the GraphQL enum. The hook converts them to the generated enum
// values before hitting the wire.
export interface CreateTripSuggestionHookInput {
  tripId: string;
  name: string;
  notes?: string;
  lat?: number;
  lng?: number;
  dayIndex?: number;
  periodOfDay?: string;
  kind?: 'waypoint' | 'note';
}

export interface RespondToTripSuggestionHookInput {
  suggestionId: string;
  decision: 'accepted' | 'rejected' | 'withdrawn';
  note?: string;
}

// Internal variables shape — tripId is injected by the hook so call sites
// don't need to thread it through. Required for the scoped invalidate in
// onSuccess (#110).
interface RespondMutationVars extends RespondToTripSuggestionHookInput {
  tripId: string;
}

const DECISION_MAP: Record<RespondToTripSuggestionHookInput['decision'], TripSuggestionDecision> = {
  accepted: TripSuggestionDecision.Accepted,
  rejected: TripSuggestionDecision.Rejected,
  withdrawn: TripSuggestionDecision.Withdrawn,
};

const KIND_MAP: Record<'waypoint' | 'note', TripSuggestionKind> = {
  waypoint: TripSuggestionKind.Waypoint,
  note: TripSuggestionKind.Note,
};

const PERIOD_MAP: Record<string, PeriodOfDay | undefined> = {
  morning: PeriodOfDay.Morning,
  afternoon: PeriodOfDay.Afternoon,
  evening: PeriodOfDay.Evening,
};

export function useTripSuggestions(tripId: string | undefined) {
  const qc = useQueryClient();
  const resolvedTripId = tripId ?? '';
  const queryKey = queryKeys.trips.suggestions(resolvedTripId);

  // #126 — track in-flight respond mutations per-suggestion so one row's
  // pending state doesn't disable action buttons on every other row.
  // Using a Set so parallel/optimistic responses on different rows each
  // get their own state without clobbering each other.
  const [respondingIds, setRespondingIds] = useState<ReadonlySet<string>>(() => new Set());

  const list = useQuery<TripSuggestionsQuery>({
    queryKey,
    enabled: !!tripId,
    queryFn: () => {
      const variables: TripSuggestionsQueryVariables = { tripId: resolvedTripId };
      return gqlFetcher(TripSuggestionsDocument, variables);
    },
  });

  const create = useMutation<CreateTripSuggestionMutation, Error, CreateTripSuggestionHookInput>({
    mutationFn: (input) =>
      gqlFetcher(CreateTripSuggestionDocument, {
        input: {
          tripId: input.tripId,
          name: input.name,
          notes: input.notes,
          lat: input.lat,
          lng: input.lng,
          dayIndex: input.dayIndex,
          periodOfDay: input.periodOfDay ? PERIOD_MAP[input.periodOfDay] : undefined,
          kind: KIND_MAP[input.kind ?? 'waypoint'],
        },
      }),
    // #110 — scope invalidate to this trip's key using the mutation variables
    // so other trips' caches are untouched.
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.trips.suggestions(variables.tripId) });
    },
  });

  const respond = useMutation<RespondToTripSuggestionMutation, Error, RespondMutationVars>({
    mutationFn: async (vars) => {
      setRespondingIds((prev) => {
        const next = new Set(prev);
        next.add(vars.suggestionId);
        return next;
      });
      try {
        return await gqlFetcher(RespondToTripSuggestionDocument, {
          input: {
            suggestionId: vars.suggestionId,
            decision: DECISION_MAP[vars.decision],
            note: vars.note,
          },
        });
      } finally {
        setRespondingIds((prev) => {
          if (!prev.has(vars.suggestionId)) return prev;
          const next = new Set(prev);
          next.delete(vars.suggestionId);
          return next;
        });
      }
    },
    // #110 — scope invalidate to this trip's suggestions.
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.trips.suggestions(vars.tripId) });
      // If an accept materialised a waypoint, trip-detail should refetch.
      if (vars.decision === 'accepted') {
        qc.invalidateQueries({ queryKey: queryKeys.trips.detail(vars.tripId) });
      }
    },
  });

  const propose = useCallback(
    (input: CreateTripSuggestionHookInput) => create.mutateAsync(input),
    [create],
  );

  // Caller signature stays `{ suggestionId, decision, note? }`; the hook
  // injects tripId so the respond mutation can scope its invalidate.
  const respondAsync = useCallback(
    (input: RespondToTripSuggestionHookInput) =>
      respond.mutateAsync({ ...input, tripId: resolvedTripId }),
    [respond, resolvedTripId],
  );

  return {
    suggestions: list.data?.tripSuggestions ?? [],
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    refetch: list.refetch,
    propose,
    respond: respondAsync,
    respondingIds,
    isProposing: create.isPending,
  };
}
