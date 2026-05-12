import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Aggregated fleet stats for a motorcycle make' })
export class MakeStats {
  @Field({ description: 'Make name (title case, e.g. "BMW")' })
  make: string;

  @Field(() => Int, { description: 'Distinct riders who own this make' })
  riders: number;

  @Field(() => Int, { description: 'Distinct models tracked for this make' })
  models: number;

  @Field(() => Int, { description: 'Total bikes of this make in the fleet' })
  totalBikes: number;

  @Field(() => Int, { description: 'Popularity rank (1 = most riders)' })
  rank: number;
}
