import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateTripInput {
  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  startDate: string;

  @Field()
  endDate: string;

  @Field()
  difficulty: string;

  @Field(() => Int)
  maxRiders: number;
}
