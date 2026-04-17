import { Field, ID, InputType } from '@nestjs/graphql';
import type { AssistantMessageRole } from '@motovault/types';
import { AssistantMessageRoleEnum } from '../../../shared/graphql/enums';

@InputType()
export class TripAssistantHistoryMessage {
  @Field(() => AssistantMessageRoleEnum)
  role: AssistantMessageRole;

  @Field(() => String)
  content: string;
}

@InputType()
export class AskTripAssistantInput {
  @Field(() => ID)
  tripId: string;

  @Field(() => String)
  question: string;

  /**
   * Prior turns so follow-ups stay contextual.
   * Bounds (array <= 20, content <= 4000, question <= 1000) are enforced by
   * `AskTripAssistantInputSchema` via `ZodValidationPipe` on the resolver.
   */
  @Field(() => [TripAssistantHistoryMessage], { nullable: true })
  history?: TripAssistantHistoryMessage[];
}
