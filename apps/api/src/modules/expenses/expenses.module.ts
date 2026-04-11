import { Module } from '@nestjs/common';
import { ExpensePhotosLoader } from './expense-photos.loader';
import { ExpensesResolver } from './expenses.resolver';
import { ExpensesService } from './expenses.service';

@Module({
  providers: [ExpensesResolver, ExpensesService, ExpensePhotosLoader],
  exports: [ExpensesService],
})
export class ExpensesModule {}
