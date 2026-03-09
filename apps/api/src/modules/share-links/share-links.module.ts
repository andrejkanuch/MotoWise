import { Module } from '@nestjs/common';
import { MaintenanceTasksModule } from '../maintenance-tasks/maintenance-tasks.module';
import { ShareLinksResolver } from './share-links.resolver';
import { ShareLinksService } from './share-links.service';

@Module({
  imports: [MaintenanceTasksModule],
  providers: [ShareLinksResolver, ShareLinksService],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}
