import { Module } from '@nestjs/common';
import { AiBudgetModule } from '../ai-budget/ai-budget.module';
import { RideSummariesResolver } from './ride-summaries.resolver';
import { RideSummariesService } from './ride-summaries.service';

@Module({
  imports: [AiBudgetModule],
  providers: [RideSummariesResolver, RideSummariesService],
})
export class RideSummariesModule {}
