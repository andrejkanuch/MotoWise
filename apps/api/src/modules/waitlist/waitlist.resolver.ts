import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { EmailService } from '../email/email.service';

@Resolver()
export class WaitlistResolver {
  constructor(private readonly emailService: EmailService) {}

  @Mutation(() => Boolean, { description: 'Submit email to join waitlist (public, no auth)' })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async joinWaitlist(@Args('email') email: string): Promise<boolean> {
    const sanitized = email.trim().toLowerCase();
    if (!sanitized || !sanitized.includes('@')) return false;

    await this.emailService.sendWaitlistNotification(sanitized);
    return true;
  }
}
