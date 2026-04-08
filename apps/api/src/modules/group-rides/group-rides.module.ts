import { Module } from '@nestjs/common';
import { GroupRidesResolver } from './group-rides.resolver';
import { GroupRidesService } from './group-rides.service';

@Module({
  providers: [GroupRidesResolver, GroupRidesService],
})
export class GroupRidesModule {}
