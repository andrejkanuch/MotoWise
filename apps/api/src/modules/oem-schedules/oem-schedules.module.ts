import { Module } from '@nestjs/common';
import { OemSchedulesResolver } from './oem-schedules.resolver';
import { OemSchedulesService } from './oem-schedules.service';

@Module({
  providers: [OemSchedulesResolver, OemSchedulesService],
  exports: [OemSchedulesService],
})
export class OemSchedulesModule {}
