import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateMotorcycleInput {
  @Field()
  make: string;

  @Field()
  model: string;

  @Field(() => Int)
  year: number;

  @Field({ nullable: true })
  nickname?: string;
}
