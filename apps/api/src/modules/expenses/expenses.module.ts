import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { CostTrendService } from './cost-trend.service';
import { ExpensePhotosLoader } from './expense-photos.loader';
import { ExpensesResolver } from './expenses.resolver';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [WebhooksModule],
  providers: [ExpensesResolver, ExpensesService, ExpensePhotosLoader, CostTrendService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
