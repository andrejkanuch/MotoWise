import { Module } from '@nestjs/common';
import { MaintenanceDuePushController } from './maintenance-due-push.controller';
import { MaintenancePushService } from './maintenance-push.service';
import { PushTokensResolver } from './push-tokens.resolver';
import { PushTokensService } from './push-tokens.service';

@Module({
  controllers: [MaintenanceDuePushController],
  providers: [PushTokensResolver, PushTokensService, MaintenancePushService],
  exports: [PushTokensService],
})
export class PushTokensModule {}
