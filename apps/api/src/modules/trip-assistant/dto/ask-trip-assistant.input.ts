import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class TripAssistantHistoryMessage {
  /** `user` or `assistant` — kept as a String for GraphQL simplicity. */
  @Field(() => String)
  role: string;

  @Field(() => String)
  content: string;
}

@InputType()
export class AskTripAssistantInput {
  @Field(() => ID)
  tripId: string;

  @Field(() => String)
  question: string;

  /** Prior turns so follow-ups stay contextual. Capped server-side. */
  @Field(() => [TripAssistantHistoryMessage], { nullable: true })
  history?: TripAssistantHistoryMessage[];
}
