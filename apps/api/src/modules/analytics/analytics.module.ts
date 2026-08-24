import { Module } from '@nestjs/common';
import { SignupEventsController } from './signup-events.controller';
import { SignupEventsService } from './signup-events.service';

/**
 * Server-side analytics emission. Exists because client-side signup counting has
 * drifted three times (see migration 00174) — the DB row is the only vantage
 * point that sees every platform and every auth path.
 */
@Module({
  controllers: [SignupEventsController],
  providers: [SignupEventsService],
  exports: [SignupEventsService],
})
export class AnalyticsModule {}
