import { Module } from '@nestjs/common';
import { InsightsResolver } from './insights.resolver';
import { InsightsService } from './insights.service';

@Module({
  providers: [InsightsResolver, InsightsService],
})
export class InsightsModule {}
