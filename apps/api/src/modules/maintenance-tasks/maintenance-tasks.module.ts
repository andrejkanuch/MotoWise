import { Module } from '@nestjs/common';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';
import { MaintenanceTasksService } from './maintenance-tasks.service';

@Module({
  providers: [MaintenanceTasksResolver, MaintenanceTasksService],
  exports: [MaintenanceTasksService],
})
export class MaintenanceTasksModule {}
