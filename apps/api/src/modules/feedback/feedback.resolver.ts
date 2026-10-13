import { SendFeedbackInputSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { SendFeedbackInput } from './dto/send-feedback.input';
import { FeedbackService } from './feedback.service';

@Resolver()
export class FeedbackResolver {
  constructor(private readonly feedbackService: FeedbackService) {}

  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.FEEDBACK })
  @Mutation(() => Boolean, {
    description:
      'Send a message to the developer. Saved, then emailed to the support inbox. Idempotent per clientId.',
  })
  async sendFeedback(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(SendFeedbackInputSchema)) input: SendFeedbackInput,
  ): Promise<boolean> {
    return this.feedbackService.sendFeedback(user, input);
  }
}
