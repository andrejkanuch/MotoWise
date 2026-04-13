import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { RoutesController } from './routes.controller';
import { RoutesResolver } from './routes.resolver';
import { RoutesService } from './routes.service';

@Module({
  imports: [EntitlementsModule],
  controllers: [RoutesController],
  providers: [RoutesResolver, RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
