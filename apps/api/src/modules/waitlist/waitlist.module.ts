import { Module } from '@nestjs/common';
import { WaitlistResolver } from './waitlist.resolver';

@Module({
  providers: [WaitlistResolver],
})
export class WaitlistModule {}
