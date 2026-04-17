import { Field, Float, ID, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateTripSuggestionInput {
  @Field(() => ID)
  tripId: string;

  @Field(() => String, { defaultValue: 'waypoint' })
  kind: string;

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

  @Field({ nullable: true })
  periodOfDay?: string;
}

@InputType()
export class RespondToTripSuggestionInput {
  @Field(() => ID)
  suggestionId: string;

  /** 'accepted' | 'rejected' | 'withdrawn' */
  @Field()
  decision: string;

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
  @Field()
  role: string;
}
