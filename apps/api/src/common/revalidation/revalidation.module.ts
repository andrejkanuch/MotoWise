import { Module } from '@nestjs/common';
import { RevalidationService } from './revalidation.service';

/** Provides the generic web-revalidation client to any feature module that imports it. */
@Module({
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
