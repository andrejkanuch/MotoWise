import { Module } from '@nestjs/common';
import { MetaModule } from '../meta/meta.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { DataExportService } from './data-export.service';
import { UsersResolver } from './users.resolver';
import { UsersService } from './users.service';

@Module({
  imports: [WebhooksModule, MetaModule],
  providers: [UsersResolver, UsersService, DataExportService],
  exports: [UsersService],
})
export class UsersModule {}
