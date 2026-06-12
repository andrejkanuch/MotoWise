import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { EmailService } from '../email/email.service';

const WaitlistEmailSchema = z
  .string()
  .email()
  .transform((v) => v.trim().toLowerCase());

@Resolver(() => Boolean)
@Public()
export class WaitlistResolver {
  constructor(private readonly emailService: EmailService) {}

  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.WAITLIST })
  @Mutation(() => Boolean, { description: 'Submit email to join waitlist (public, no auth)' })
  async joinWaitlist(
    @Args('email', new ZodValidationPipe(WaitlistEmailSchema)) email: string,
  ): Promise<boolean> {
    await this.emailService.sendWaitlistNotification(email);
    return true;
  }
}
