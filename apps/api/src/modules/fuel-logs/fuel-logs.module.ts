import { Module } from '@nestjs/common';
import { FuelLogsResolver } from './fuel-logs.resolver';
import { FuelLogsService } from './fuel-logs.service';

@Module({
  providers: [FuelLogsResolver, FuelLogsService],
  exports: [FuelLogsService],
})
export class FuelLogsModule {}
