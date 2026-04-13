import { Module } from '@nestjs/common';
import { SponsorshipsResolver } from './sponsorships.resolver';
import { SponsorshipsService } from './sponsorships.service';

@Module({
  providers: [SponsorshipsResolver, SponsorshipsService],
})
export class SponsorshipsModule {}
