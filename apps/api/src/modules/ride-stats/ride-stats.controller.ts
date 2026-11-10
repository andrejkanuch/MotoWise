import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { RideStatsService } from './ride-stats.service';

const TIMING_SAFE_KEY = 'ride-stats-sweep-timing-safe-compare' as const;
const SECRET_HEADER = 'x-ride-stats-secret' as const;

function safeCompare(a: string, b: string): boolean {
  const hmac = (v: string) => createHmac('sha256', TIMING_SAFE_KEY).update(v).digest();
  return timingSafeEqual(hmac(a), hmac(b));
}

/**
 * Sweep entrypoint for per-ride stats: computes up to 10 stale rides (backfill,
 * lost events, version bumps, late waypoint uploads). Called by pg_cron every
 * 10 minutes through pg_net with a Vault secret.
 *
 * `@Public()` exempts this from the JWT guard; the shared-secret comparison is the
 * real authentication and fails closed when RIDE_STATS_SWEEP_SECRET is unset.
 * Takes no body: which rides are computed comes from the database, never the caller.
 */
@Public()
@Controller('webhooks')
export class RideStatsSweepController {
  constructor(
    private readonly service: RideStatsService,
    private readonly config: ConfigService,
  ) {}

  @Post('ride-stats-sweep')
  @HttpCode(200)
  async handle(@Headers(SECRET_HEADER) secretHeader: string) {
    const secret = this.config.get<string>('RIDE_STATS_SWEEP_SECRET');
    if (!secret || !secretHeader || !safeCompare(secretHeader, secret)) {
      throw new UnauthorizedException('Invalid ride-stats sweep authorization');
    }

    const summary = await this.service.sweepStale();
    // Spread first so a future summary field can never shadow the status literal.
    return { ...summary, status: 'ok' };
  }
}
