import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { RideIdleService } from './ride-idle.service';

const TIMING_SAFE_KEY = 'ride-idle-timing-safe-compare' as const;
const SECRET_HEADER = 'x-ride-idle-secret' as const;

function safeCompare(a: string, b: string): boolean {
  const hmac = (v: string) => createHmac('sha256', TIMING_SAFE_KEY).update(v).digest();
  return timingSafeEqual(hmac(a), hmac(b));
}

/**
 * Hourly sweep entrypoint for the idle-ride nudge / auto-end (migration 00173).
 *
 * `@Public()` exempts this from the JWT guard; the shared-secret comparison is the
 * real authentication and fails closed when RIDE_IDLE_SECRET is unset. Invoked by
 * pg_cron via `public.cron_trigger_ride_idle_check()`.
 *
 * Takes no body: the thresholds are service constants, not caller-controlled, so a
 * leaked secret can't be used to end rides early.
 */
@Public()
@Controller('webhooks')
export class RideIdleCheckController {
  constructor(
    private readonly service: RideIdleService,
    private readonly config: ConfigService,
  ) {}

  @Post('ride-idle-check')
  @HttpCode(200)
  async handle(@Headers(SECRET_HEADER) secretHeader: string) {
    const secret = this.config.get<string>('RIDE_IDLE_SECRET');
    if (!secret || !secretHeader || !safeCompare(secretHeader, secret)) {
      throw new UnauthorizedException('Invalid ride-idle trigger authorization');
    }

    const summary = await this.service.sweepIdleRides();
    // Spread first so a future summary field can never shadow the status literal.
    return { ...summary, status: 'ok' };
  }
}
