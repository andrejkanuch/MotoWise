import { AskTripAssistantInputSchema } from '@motovault/types';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AskTripAssistantInput } from './dto/ask-trip-assistant.input';
import { TripAssistantMessage } from './models/trip-assistant-message.model';
import { TripAssistantService } from './trip-assistant.service';

@Resolver(() => TripAssistantMessage)
export class TripAssistantResolver {
  constructor(private readonly service: TripAssistantService) {}

  @Mutation(() => TripAssistantMessage)
  async askTripAssistant(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(AskTripAssistantInputSchema))
    input: AskTripAssistantInput,
  ): Promise<TripAssistantMessage> {
    return this.service.ask(user.id, input);
  }
}
