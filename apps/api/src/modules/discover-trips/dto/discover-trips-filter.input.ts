import { Field, InputType, Int } from '@nestjs/graphql';
import {
  SurfaceTypeEnum,
  TripDifficultyEnum,
} from '../../../shared/graphql/enums';

@InputType()
export class DiscoverTripsFilterInput {
  @Field({ nullable: true })
  country?: string;

  @Field(() => TripDifficultyEnum, { nullable: true })
  difficulty?: string;

  @Field(() => Int, { nullable: true })
  dayCountMin?: number;

  @Field(() => Int, { nullable: true })
  dayCountMax?: number;

  @Field(() => SurfaceTypeEnum, { nullable: true })
  surfaceType?: string;

  @Field({ nullable: true })
  searchText?: string;
}
