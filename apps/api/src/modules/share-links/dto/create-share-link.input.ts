import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateShareLinkInput {
  @Field()
  motorcycleId: string;

  @Field(() => Int, { nullable: true, defaultValue: 30 })
  expiresInDays?: number;
}
