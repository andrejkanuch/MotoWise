import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GqlGenerationStatus } from '../../../common/enums/graphql-enums';

@ObjectType()
export class RideSummary {
  @Field(() => ID)
  id: string;

  @Field()
  rideId: string;

  @Field()
  summaryText: string;

  @Field(() => GqlGenerationStatus)
  generationStatus: string;

  @Field()
  locale: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
