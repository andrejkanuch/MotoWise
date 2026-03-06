import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateMotorcycleInput {
  @Field(() => String, { nullable: true })
  make?: string;

  @Field(() => String, { nullable: true })
  model?: string;

  @Field(() => Int, { nullable: true })
  year?: number;

  @Field(() => String, { nullable: true })
  nickname?: string;
}
