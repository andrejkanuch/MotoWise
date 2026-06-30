import { Module } from '@nestjs/common';
import { PushTokensResolver } from './push-tokens.resolver';
import { PushTokensService } from './push-tokens.service';

@Module({
  providers: [PushTokensResolver, PushTokensService],
  exports: [PushTokensService],
})
export class PushTokensModule {}
