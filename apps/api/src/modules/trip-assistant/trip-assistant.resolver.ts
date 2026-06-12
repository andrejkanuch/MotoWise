import { AskTripAssistantInputSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { AskTripAssistantInput } from './dto/ask-trip-assistant.input';
import { TripAssistantMessage } from './models/trip-assistant-message.model';
import { TripAssistantService } from './trip-assistant.service';

@Resolver(() => TripAssistantMessage)
export class TripAssistantResolver {
  constructor(private readonly service: TripAssistantService) {}

  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.AI_GENERATION })
  @Mutation(() => TripAssistantMessage)
  async askTripAssistant(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(AskTripAssistantInputSchema))
    input: AskTripAssistantInput,
  ): Promise<TripAssistantMessage> {
    return this.service.ask(user.id, input);
  }
}
