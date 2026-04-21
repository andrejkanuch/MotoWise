/**
 * GraphQL enum registrations for trip collaboration (suggestions, participant
 * roles, period-of-day) + the trip-assistant conversation role.
 *
 * NestJS `registerEnumType` uses the object KEY as the GraphQL enum member
 * name. The mobile + web clients send lowercase values (`'morning'`, `'accepted'`,
 * `'co_planner'`) today, so we keep keys equal to values to preserve wire
 * compatibility — same pattern used in `apps/api/src/common/enums/graphql-enums.ts`.
 *
 * The underlying string-const unions live in `@motovault/types`; these
 * adapters are the thin bridge that lets @nestjs/graphql generate schema enums.
 *
 * Import this file side-effect-only from every module whose models/inputs
 * reference these enums so NestJS registers them before the schema is built.
 */
import { registerEnumType } from '@nestjs/graphql';

export const TripSuggestionKindEnum = {
  waypoint: 'waypoint',
  note: 'note',
} as const;
registerEnumType(TripSuggestionKindEnum, {
  name: 'TripSuggestionKind',
  description: 'Kind of a trip suggestion (waypoint or note).',
});

export const TripSuggestionStatusEnum = {
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
} as const;
registerEnumType(TripSuggestionStatusEnum, {
  name: 'TripSuggestionStatus',
  description: 'Lifecycle of a trip suggestion.',
});

export const TripSuggestionDecisionEnum = {
  accepted: 'accepted',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
} as const;
registerEnumType(TripSuggestionDecisionEnum, {
  name: 'TripSuggestionDecision',
  description: 'Decision applied to a pending trip suggestion.',
});

export const ParticipantRoleEnum = {
  organizer: 'organizer',
  rider: 'rider',
  co_planner: 'co_planner',
} as const;
registerEnumType(ParticipantRoleEnum, {
  name: 'ParticipantRole',
  description: 'Role of a trip participant.',
});

export const PeriodOfDayEnum = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
} as const;
registerEnumType(PeriodOfDayEnum, {
  name: 'PeriodOfDay',
  description: 'Period of the day assigned to a waypoint or ride segment.',
});

export const AssistantMessageRoleEnum = {
  user: 'user',
  assistant: 'assistant',
} as const;
registerEnumType(AssistantMessageRoleEnum, {
  name: 'AssistantMessageRole',
  description: 'Role of a message in the trip assistant conversation.',
});

// --- Discover Trip Enums ---

export const TripDifficultyEnum = {
  easy: 'easy',
  moderate: 'moderate',
  challenging: 'challenging',
  expert: 'expert',
} as const;
registerEnumType(TripDifficultyEnum, {
  name: 'TripDifficulty',
  description: 'Difficulty rating for a trip or discover template.',
});

export const SurfaceTypeEnum = {
  paved: 'paved',
  mixed: 'mixed',
  off_road: 'off-road',
  unknown: 'unknown',
} as const;
registerEnumType(SurfaceTypeEnum, {
  name: 'SurfaceType',
  description: 'Road surface type for a route or trip.',
  valuesMap: { off_road: { description: 'Off-road / unpaved surface' } },
});

export const DiscoverTripStatusEnum = {
  published: 'published',
  hidden: 'hidden',
  flagged: 'flagged',
  unpublished: 'unpublished',
} as const;
registerEnumType(DiscoverTripStatusEnum, {
  name: 'DiscoverTripStatus',
  description: 'Status of a discover trip template.',
});
