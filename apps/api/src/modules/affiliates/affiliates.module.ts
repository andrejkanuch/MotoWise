import { Module } from '@nestjs/common';
import { AffiliatesResolver } from './affiliates.resolver';
import { AffiliatesService } from './affiliates.service';

@Module({
  providers: [AffiliatesResolver, AffiliatesService],
})
export class AffiliatesModule {}
