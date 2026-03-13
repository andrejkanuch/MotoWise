import { forwardRef, Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';
import { MaintenanceTasksService } from './maintenance-tasks.service';

@Module({
  imports: [forwardRef(() => ExpensesModule)],
  providers: [MaintenanceTasksResolver, MaintenanceTasksService],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
