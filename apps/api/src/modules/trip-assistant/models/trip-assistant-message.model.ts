import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TripAssistantMessage {
  @Field(() => String)
  message: string;

  @Field(() => Int, { nullable: true })
  inputTokens?: number;

  @Field(() => Int, { nullable: true })
  outputTokens?: number;
}
