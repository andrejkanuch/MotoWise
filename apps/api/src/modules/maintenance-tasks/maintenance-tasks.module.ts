import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { TaskLineItemsLoader } from './task-line-items.loader';
import { TaskPhotosLoader } from './task-photos.loader';

@Module({
  imports: [ExpensesModule],
  providers: [
    MaintenanceTasksResolver,
    MaintenanceTasksService,
    TaskPhotosLoader,
    TaskLineItemsLoader,
  ],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
