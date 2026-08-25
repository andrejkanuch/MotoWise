import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { SignupEventsService, SWEEP_OUTCOME } from './signup-events.service';

const TIMING_SAFE_KEY = 'signup-events-timing-safe-compare' as const;
const SECRET_HEADER = 'x-signup-event-secret' as const;

function safeCompare(a: string, b: string): boolean {
  const hmac = (v: string) => createHmac('sha256', TIMING_SAFE_KEY).update(v).digest();
  return timingSafeEqual(hmac(a), hmac(b));
}

/**
 * Sweep entrypoint for the canonical signup event (migration 00174).
 *
 * `@Public()` exempts this from the JWT guard; the shared-secret comparison is the
 * real authentication and fails closed when SIGNUP_EVENT_SECRET is unset. Invoked
 * by pg_cron via `public.cron_trigger_signup_events()` every 10 minutes.
 *
 * Takes no body. Which users are pending is derived entirely from
 * signup_event_log, so a leaked secret can at worst trigger the sweep early — it
 * cannot be used to emit an event for a chosen user, or to emit one twice.
 */
@Public()
@Controller('webhooks')
export class SignupEventsController {
  constructor(
    private readonly service: SignupEventsService,
    private readonly config: ConfigService,
  ) {}

  @Post('signup-events')
  @HttpCode(200)
  async handle(@Headers(SECRET_HEADER) secretHeader: string) {
    const secret = this.config.get<string>('SIGNUP_EVENT_SECRET');
    if (!secret || !secretHeader || !safeCompare(secretHeader, secret)) {
      throw new UnauthorizedException('Invalid signup-event trigger authorization');
    }

    const summary = await this.service.sweepPendingSignups();
    // `status` reports whether the SWEEP worked, not whether the request parsed.
    // It used to be the literal 'ok' unconditionally, which is how a claim RPC
    // that raised on every call still answered `status: "ok"` for a full day
    // (see SWEEP_OUTCOME). Spread first so a summary field cannot shadow it.
    return { ...summary, status: summary.outcome === SWEEP_OUTCOME.OK ? 'ok' : 'error' };
  }
}
