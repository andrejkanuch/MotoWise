import { Global, Module } from '@nestjs/common';
import { AiBudgetResolver } from './ai-budget.resolver';
import { AiBudgetService } from './ai-budget.service';

@Global()
@Module({
  providers: [AiBudgetService, AiBudgetResolver],
  exports: [AiBudgetService],
})
export class AiBudgetModule {}
