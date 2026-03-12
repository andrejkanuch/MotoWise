import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { revenueCatWebhookPayloadSchema } from './dto/revenuecat-event.dto';
import { RevenueCatService } from './revenuecat.service';

function safeCompare(a: string, b: string): boolean {
  const hmac = (v: string) => createHmac('sha256', 'webhook-compare-key').update(v).digest();
  return timingSafeEqual(hmac(a), hmac(b));
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
  async handle(
    @Headers('authorization') authHeader: string,
    @Body() rawBody: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const secret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!secret || !authHeader || !safeCompare(authHeader, secret)) {
      throw new UnauthorizedException('Invalid webhook authorization');
    }

    const parsed = revenueCatWebhookPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      this.logger.warn(`Invalid webhook payload: ${parsed.error.message}`);
      res.status(HttpStatus.UNPROCESSABLE_ENTITY);
      return { status: 'invalid_payload' };
    }

    await this.service.processEvent(parsed.data.event);
    return { status: 'processed' };
  }
}
