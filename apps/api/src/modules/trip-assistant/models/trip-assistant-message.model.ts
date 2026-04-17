import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TripAssistantMessage {
  @Field(() => String)
  message: string;
}
