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
import { useCallback } from 'react';
import { gqlFetcher } from '../lib/graphql-client';

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

const DECISION_MAP: Record<
  RespondToTripSuggestionHookInput['decision'],
  TripSuggestionDecision
> = {
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
  const queryKey = ['trip-suggestions', tripId ?? ''];

  const list = useQuery<TripSuggestionsQuery>({
    queryKey,
    enabled: !!tripId,
    queryFn: () => {
      const variables: TripSuggestionsQueryVariables = { tripId: tripId ?? '' };
      return gqlFetcher(TripSuggestionsDocument, variables);
    },
  });

  const create = useMutation<
    CreateTripSuggestionMutation,
    Error,
    CreateTripSuggestionHookInput
  >({
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const respond = useMutation<
    RespondToTripSuggestionMutation,
    Error,
    RespondToTripSuggestionHookInput
  >({
    mutationFn: (input) =>
      gqlFetcher(RespondToTripSuggestionDocument, {
        input: {
          suggestionId: input.suggestionId,
          decision: DECISION_MAP[input.decision],
          note: input.note,
        },
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey });
      // If an accept materialised a waypoint, trip-detail should refetch.
      if (vars.decision === 'accepted') {
        qc.invalidateQueries({ queryKey: ['trip'] });
      }
    },
  });

  const propose = useCallback(
    (input: CreateTripSuggestionHookInput) => create.mutateAsync(input),
    [create],
  );

  return {
    suggestions: list.data?.tripSuggestions ?? [],
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    refetch: list.refetch,
    propose,
    respond: respond.mutateAsync,
    isResponding: respond.isPending,
    isProposing: create.isPending,
  };
}
