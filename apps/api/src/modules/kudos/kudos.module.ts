import { Module } from '@nestjs/common';
import { KudosResolver } from './kudos.resolver';
import { KudosService } from './kudos.service';

@Module({
  providers: [KudosResolver, KudosService],
})
export class KudosModule {}
