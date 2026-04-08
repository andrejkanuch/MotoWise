import { Module } from '@nestjs/common';
import { RoutesController } from './routes.controller';
import { RoutesResolver } from './routes.resolver';
import { RoutesService } from './routes.service';

@Module({
  controllers: [RoutesController],
  providers: [RoutesResolver, RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
