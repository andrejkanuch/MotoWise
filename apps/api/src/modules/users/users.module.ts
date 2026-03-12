import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { DataExportService } from './data-export.service';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [WebhooksModule],
  providers: [UsersResolver, UsersService, DataExportService],
  exports: [UsersService],
})
export class UsersModule {}
