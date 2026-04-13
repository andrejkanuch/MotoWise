import { Module } from '@nestjs/common';
import { EntitlementService } from './entitlements.service';

@Module({
  providers: [EntitlementService],
  exports: [EntitlementService],
})
export class EntitlementsModule {}
