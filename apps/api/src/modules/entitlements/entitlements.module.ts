import { Module } from '@nestjs/common';
<<<<<<< HEAD
import { EntitlementsService } from './entitlements.service';

@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
=======
import { EntitlementService } from './entitlements.service';

@Module({
  providers: [EntitlementService],
  exports: [EntitlementService],
>>>>>>> feat/mot-195-198-unit-tests
})
export class EntitlementsModule {}
