import { createHmac, timingSafeEqual } from 'node:crypto';
import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { Public } from '../../common/decorators/public.decorator';
import { MaintenancePushService } from './maintenance-push.service';

const TIMING_SAFE_KEY = 'maintenance-push-timing-safe-compare' as const;
const SECRET_HEADER = 'x-maintenance-push-secret' as const;
const DEFAULT_DAYS_BEFORE = 1 as const;

function safeCompare(a: string, b: string): boolean {
  const hmac = (v: string) => createHmac('sha256', TIMING_SAFE_KEY).update(v).digest();
  return timingSafeEqual(hmac(a), hmac(b));
}

const TriggerBodySchema = z.object({
  daysBefore: z.number().int().min(0).max(90).optional(),
});

// @Public() exempts this from the JWT guard; the HMAC secret comparison is the real
// authentication and fails closed when MAINTENANCE_PUSH_SECRET is unset. Invoked by
// the scheduler (U9) or manually for now.
@Public()
@Controller('webhooks')
export class MaintenanceDuePushController {
  constructor(
    private readonly service: MaintenancePushService,
    private readonly config: ConfigService,
  ) {}

  @Post('maintenance-due-push')
  @HttpCode(200)
  async handle(@Headers(SECRET_HEADER) secretHeader: string, @Body() rawBody: unknown) {
    const secret = this.config.get<string>('MAINTENANCE_PUSH_SECRET');
    if (!secret || !secretHeader || !safeCompare(secretHeader, secret)) {
      throw new UnauthorizedException('Invalid push trigger authorization');
    }

    const parsed = TriggerBodySchema.safeParse(rawBody ?? {});
    const daysBefore = (parsed.success ? parsed.data.daysBefore : undefined) ?? DEFAULT_DAYS_BEFORE;

    const summary = await this.service.sendDuePush(daysBefore);
    // Spread first so a future summary field can never shadow the status literal.
    return { ...summary, status: 'ok' };
  }
}
