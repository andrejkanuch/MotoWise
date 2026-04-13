import { Module } from '@nestjs/common';
import { EntitlementsResolver } from './entitlements.resolver';
import { EntitlementsService } from './entitlements.service';

@Module({
  providers: [EntitlementsResolver, EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
