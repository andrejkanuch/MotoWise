import type { ParticipantRole, TripSuggestionDecision, TripSuggestionKind } from '@motovault/types';
import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import {
  ParticipantRoleEnum,
  PeriodOfDayEnum,
  TripSuggestionDecisionEnum,
  TripSuggestionKindEnum,
} from '../../../shared/graphql/enums';

type PeriodOfDay = (typeof PeriodOfDayEnum)[keyof typeof PeriodOfDayEnum];

@InputType()
export class CreateTripSuggestionInput {
  @Field(() => ID)
  tripId: string;

  @Field(() => TripSuggestionKindEnum, { defaultValue: 'waypoint' })
  kind: TripSuggestionKind;

  @Field()
  name: string;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => Float, { nullable: true })
  lat?: number;

  @Field(() => Float, { nullable: true })
  lng?: number;

  @Field(() => Int, { nullable: true })
  dayIndex?: number;

  @Field(() => PeriodOfDayEnum, { nullable: true })
  periodOfDay?: PeriodOfDay;
}

@InputType()
export class RespondToTripSuggestionInput {
  @Field(() => ID)
  suggestionId: string;

  @Field(() => TripSuggestionDecisionEnum)
  decision: TripSuggestionDecision;

  @Field({ nullable: true })
  note?: string;
}

@InputType()
export class SetParticipantRoleInput {
  @Field(() => ID)
  tripId: string;

  @Field(() => ID)
  userId: string;

  /** 'co_planner' | 'rider' — organisers remain untouched via this API. */
  @Field(() => ParticipantRoleEnum)
  role: ParticipantRole;
}
