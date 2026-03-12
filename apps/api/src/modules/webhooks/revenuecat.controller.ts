import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { revenueCatWebhookPayloadSchema } from './dto/revenuecat-event.dto';
import { RevenueCatService } from './revenuecat.service';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('webhooks')
export class RevenueCatWebhookController {
  private readonly logger = new Logger(RevenueCatWebhookController.name);

  constructor(
    private readonly service: RevenueCatService,
    private readonly config: ConfigService,
  ) {}

  @Post('revenuecat')
  @HttpCode(200)
  async handle(@Headers('authorization') authHeader: string, @Body() rawBody: unknown) {
    const secret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!secret || !authHeader || !safeCompare(authHeader, secret)) {
      throw new UnauthorizedException('Invalid webhook authorization');
    }

    const parsed = revenueCatWebhookPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      this.logger.warn(`Invalid webhook payload: ${parsed.error.message}`);
      return { status: 'invalid_payload' };
    }

    await this.service.processEvent(parsed.data.event);
    return { status: 'processed' };
  }
}
