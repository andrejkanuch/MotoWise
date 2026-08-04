import { Module } from '@nestjs/common';
import { MaintenanceDuePushController } from './maintenance-due-push.controller';
import { MaintenancePushService } from './maintenance-push.service';
import { PushTokensResolver } from './push-tokens.resolver';
import { PushTokensService } from './push-tokens.service';
import { RideIdleService } from './ride-idle.service';
import { RideIdleCheckController } from './ride-idle-check.controller';

@Module({
  controllers: [MaintenanceDuePushController, RideIdleCheckController],
  providers: [PushTokensResolver, PushTokensService, MaintenancePushService, RideIdleService],
  exports: [PushTokensService],
})
export class PushTokensModule {}
