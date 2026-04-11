import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { TaskPhotosLoader } from './task-photos.loader';

@Module({
  imports: [ExpensesModule],
  providers: [MaintenanceTasksResolver, MaintenanceTasksService, TaskPhotosLoader],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
