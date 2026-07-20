import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { TaskLineItemsLoader } from './loaders/task-line-items.loader';
import { TaskPhotosLoader } from './loaders/task-photos.loader';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { MaintenanceLineItemsService } from './services/maintenance-line-items.service';
import { MaintenanceSpendingService } from './services/maintenance-spending.service';
import { MaintenanceTaskPhotosService } from './services/maintenance-task-photos.service';

@Module({
  imports: [ExpensesModule],
  providers: [
    MaintenanceTasksResolver,
    MaintenanceTasksService,
    MaintenanceTaskPhotosService,
    MaintenanceLineItemsService,
    MaintenanceSpendingService,
    TaskPhotosLoader,
    TaskLineItemsLoader,
  ],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
