/**
 * P5.1 — client hook for trip suggestions.
 *
 * Uses inline graphql.parse so we don't need codegen to run before the next
 * push (sandbox codegen is currently broken — see P2.3 notes).
 */
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { parse } from 'graphql';
import { useCallback } from 'react';
import { gqlFetcher } from '../lib/graphql-client';

export interface TripSuggestionAuthor {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  publicUsername?: string | null;
}

export interface TripSuggestion {
  id: string;
  tripId: string;
  kind: string;
  name: string;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  dayIndex?: number | null;
  periodOfDay?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  decidedBy?: string | null;
  decidedAt?: string | null;
  decidedNote?: string | null;
  waypointId?: string | null;
  createdAt: string;
  author: TripSuggestionAuthor;
}

interface ListData {
  tripSuggestions: TripSuggestion[];
}
interface ListVars {
  tripId: string;
}

const TripSuggestionsDocument = parse(/* GraphQL */ `
  query TripSuggestions($tripId: ID!) {
    tripSuggestions(tripId: $tripId) {
      id
      tripId
      kind
      name
      notes
      lat
      lng
      dayIndex
      periodOfDay
      status
      decidedBy
      decidedAt
      decidedNote
      waypointId
      createdAt
      author {
        id
        displayName
        avatarUrl
        publicUsername
      }
    }
  }
`) as TypedDocumentNode<ListData, ListVars>;

interface CreateInput {
  tripId: string;
  name: string;
  notes?: string;
  lat?: number;
  lng?: number;
  dayIndex?: number;
  periodOfDay?: string;
  kind?: string;
}
interface CreateData {
  createTripSuggestion: TripSuggestion;
}
interface CreateVars {
  input: CreateInput;
}

const CreateTripSuggestionDocument = parse(/* GraphQL */ `
  mutation CreateTripSuggestion($input: CreateTripSuggestionInput!) {
    createTripSuggestion(input: $input) {
      id
      tripId
      status
      name
      notes
      lat
      lng
      dayIndex
      periodOfDay
      createdAt
      author {
        id
        displayName
        avatarUrl
      }
    }
  }
`) as TypedDocumentNode<CreateData, CreateVars>;

interface RespondInput {
  suggestionId: string;
  decision: 'accepted' | 'rejected' | 'withdrawn';
  note?: string;
}
interface RespondData {
  respondToTripSuggestion: TripSuggestion;
}
interface RespondVars {
  input: RespondInput;
}

const RespondToTripSuggestionDocument = parse(/* GraphQL */ `
  mutation RespondToTripSuggestion($input: RespondToTripSuggestionInput!) {
    respondToTripSuggestion(input: $input) {
      id
      status
      decidedBy
      decidedAt
      decidedNote
      waypointId
    }
  }
`) as TypedDocumentNode<RespondData, RespondVars>;

export function useTripSuggestions(tripId: string | undefined) {
  const qc = useQueryClient();
  const queryKey = ['trip-suggestions', tripId ?? ''];

  const list = useQuery<ListData>({
    queryKey,
    enabled: !!tripId,
    queryFn: () => gqlFetcher(TripSuggestionsDocument, { tripId: tripId ?? '' }),
  });

  const create = useMutation({
    mutationFn: (input: CreateInput) =>
      gqlFetcher(CreateTripSuggestionDocument, { input: { kind: 'waypoint', ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const respond = useMutation({
    mutationFn: (input: RespondInput) =>
      gqlFetcher(RespondToTripSuggestionDocument, { input }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey });
      // If an accept materialised a waypoint, trip-detail should refetch.
      if (vars.decision === 'accepted') {
        qc.invalidateQueries({ queryKey: ['trip'] });
      }
    },
  });

  const propose = useCallback(
    (input: CreateInput) => create.mutateAsync(input),
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
