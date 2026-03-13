import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';
import { MaintenanceTasksService } from './maintenance-tasks.service';

@Module({
  imports: [ExpensesModule],
  providers: [MaintenanceTasksResolver, MaintenanceTasksService],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
