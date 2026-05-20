import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmailService } from '../email/email.service';

const WaitlistEmailSchema = z
  .string()
  .email()
  .transform((v) => v.trim().toLowerCase());

@Resolver(() => Boolean)
export class WaitlistResolver {
  constructor(private readonly emailService: EmailService) {}

  @Mutation(() => Boolean, { description: 'Submit email to join waitlist (public, no auth)' })
  async joinWaitlist(
    @Args('email', new ZodValidationPipe(WaitlistEmailSchema)) email: string,
  ): Promise<boolean> {
    await this.emailService.sendWaitlistNotification(email);
    return true;
  }
}
