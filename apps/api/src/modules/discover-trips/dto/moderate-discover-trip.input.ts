import { Field, ID, InputType } from '@nestjs/graphql';
import { DiscoverTripStatusEnum } from '../../../shared/graphql/enums';

@InputType()
export class ModerateDiscoverTripInput {
  @Field(() => ID)
  discoverTripId: string;

  @Field(() => DiscoverTripStatusEnum)
  status: string;
}
