import type { TripSuggestionKind, TripSuggestionStatus } from '@motovault/types';
import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  PeriodOfDayEnum,
  TripSuggestionKindEnum,
  TripSuggestionStatusEnum,
} from '../../../shared/graphql/enums';

type PeriodOfDay = (typeof PeriodOfDayEnum)[keyof typeof PeriodOfDayEnum];

/**
 * A lightweight author projection for suggestion cards. Kept separate from
 * TripOrganiser so we don't couple suggestion responses to the trips module.
 */
@ObjectType()
export class TripSuggestionAuthor {
  @Field(() => ID)
  id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  publicUsername?: string;
}

@ObjectType()
export class TripSuggestion {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  tripId: string;

  @Field(() => TripSuggestionKindEnum)
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

  @Field(() => TripSuggestionStatusEnum)
  status: TripSuggestionStatus;

  @Field({ nullable: true })
  decidedBy?: string;

  @Field({ nullable: true })
  decidedAt?: string;

  @Field({ nullable: true })
  decidedNote?: string;

  @Field({ nullable: true })
  waypointId?: string;

  @Field()
  createdAt: string;

  @Field(() => TripSuggestionAuthor)
  author: TripSuggestionAuthor;
}
