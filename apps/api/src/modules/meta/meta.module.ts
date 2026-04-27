import { Module } from '@nestjs/common';
import { MetaEventsService } from './meta-events.service';

@Module({
  providers: [MetaEventsService],
  exports: [MetaEventsService],
})
export class MetaModule {}
